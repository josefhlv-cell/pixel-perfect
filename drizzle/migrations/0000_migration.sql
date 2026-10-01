
-- ===== Enums =====
CREATE TYPE public.freshness_status AS ENUM ('FRESH','RECENT','AGING','STALE','EXPIRED','UNKNOWN');
CREATE TYPE public.availability_status AS ENUM ('ACTIVE_CONFIRMED','ACTIVE_UNCONFIRMED','RESERVED','SOLD','REMOVED','EXPIRED','UNKNOWN');
CREATE TYPE public.alert_severity AS ENUM ('info','opportunity','warning');
CREATE TYPE public.plan_tier AS ENUM ('FREE','PRO');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  plan plan_tier NOT NULL DEFAULT 'FREE',
  disclaimer_accepted_at timestamptz,
  locale text NOT NULL DEFAULT 'cs',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- prevent self-upgrade of plan
CREATE OR REPLACE FUNCTION public.protect_plan() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN NEW.plan := 'FREE';
    ELSIF NEW.plan IS DISTINCT FROM OLD.plan THEN NEW.plan := OLD.plan; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_protect_plan BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_plan();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== investor_profiles =====
CREATE TABLE public.investor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  locations text[] NOT NULL DEFAULT '{}',
  property_types text[] NOT NULL DEFAULT '{}',
  min_price bigint, max_price bigint,
  min_area_m2 numeric, max_area_m2 numeric,
  min_gross_yield_bps integer,
  strategy text NOT NULL DEFAULT 'long_term_rental',
  ltv_bps integer NOT NULL DEFAULT 8000,
  interest_rate_bps integer NOT NULL DEFAULT 489,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.investor_profiles(user_id);

-- ===== catalog: properties / listings =====
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  is_sample boolean NOT NULL DEFAULT false,
  property_type text,
  disposition text,
  area_m2 numeric,
  city text,
  district text,
  address text,
  latitude double precision,
  longitude double precision,
  condition text,
  building_type text,
  floor integer,
  energy_class text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.properties(city);
CREATE INDEX ON public.properties(created_by);

CREATE TABLE public.property_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.property_snapshots(property_id);

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by uuid,
  is_sample boolean NOT NULL DEFAULT false,
  source_url text NOT NULL,
  source_domain text NOT NULL,
  source_type text NOT NULL DEFAULT 'portal',
  external_id text,
  title text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  last_verified_at timestamptz,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  price bigint,
  currency text NOT NULL DEFAULT 'CZK',
  area_m2 numeric,
  rooms text,
  property_type text,
  location text,
  address text,
  latitude double precision,
  longitude double precision,
  availability_status availability_status NOT NULL DEFAULT 'UNKNOWN',
  availability_confidence numeric,
  freshness_status freshness_status NOT NULL DEFAULT 'UNKNOWN',
  freshness_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url)
);
CREATE INDEX ON public.listings(property_id);
CREATE INDEX ON public.listings(availability_status);
CREATE INDEX ON public.listings(location);

CREATE TABLE public.listing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  price bigint,
  availability_status availability_status NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);
CREATE INDEX ON public.listing_snapshots(listing_id, observed_at);

CREATE TABLE public.listing_freshness_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  http_status integer,
  previous_status availability_status,
  new_status availability_status,
  freshness_status freshness_status,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.listing_freshness_events(listing_id, created_at);

CREATE TABLE public.property_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  method text NOT NULL,
  estimated_value bigint,
  low_value bigint, high_value bigint,
  comparables_count integer,
  confidence text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.property_valuations(property_id);

CREATE TABLE public.market_comparables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  comparable_listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  price_per_m2 bigint,
  distance_m integer,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.market_comparables(property_id);

CREATE TABLE public.rent_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  monthly_rent bigint,
  low_rent bigint, high_rent bigint,
  method text NOT NULL,
  confidence text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.rent_estimates(property_id);

CREATE TABLE public.market_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  period date NOT NULL,
  avg_asking_price_m2 bigint,
  avg_rent_m2 bigint,
  listings_count integer,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, period, is_sample)
);

-- catalog grants & policies
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['properties','property_snapshots','listings','listing_snapshots','listing_freshness_events','property_valuations','market_comparables','rent_estimates','market_statistics'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "authenticated read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- manual entry: users may create their own properties/listings
GRANT INSERT, UPDATE, DELETE ON public.properties TO authenticated;
CREATE POLICY "own properties insert" ON public.properties FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND is_sample = false);
CREATE POLICY "own properties update" ON public.properties FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid() AND is_sample = false);
CREATE POLICY "own properties delete" ON public.properties FOR DELETE TO authenticated USING (created_by = auth.uid());
GRANT INSERT, UPDATE ON public.listings TO authenticated;
CREATE POLICY "own listings insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND is_sample = false);
CREATE POLICY "own listings update" ON public.listings FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
-- append-only history: insert only, for owners of the listing
GRANT INSERT ON public.listing_snapshots, public.listing_freshness_events TO authenticated;
CREATE POLICY "own listing snapshot insert" ON public.listing_snapshots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.created_by = auth.uid()));
CREATE POLICY "own freshness insert" ON public.listing_freshness_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.created_by = auth.uid()));

-- hard append-only guard (even for service role)
CREATE OR REPLACE FUNCTION public.forbid_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME; END; $$;
CREATE TRIGGER listing_snapshots_append_only BEFORE UPDATE ON public.listing_snapshots FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER freshness_events_append_only BEFORE UPDATE ON public.listing_freshness_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TRIGGER properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER listings_updated BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== user-owned tables =====
CREATE TABLE public.investment_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  inputs jsonb NOT NULL,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.calculation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  name text NOT NULL,
  inputs jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.portfolio_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  name text NOT NULL,
  city text,
  area_m2 numeric,
  purchase_price bigint NOT NULL,
  purchase_date date NOT NULL,
  current_value bigint,
  mortgage_principal bigint NOT NULL DEFAULT 0,
  interest_rate_bps integer NOT NULL DEFAULT 0,
  term_months integer NOT NULL DEFAULT 360,
  monthly_rent bigint NOT NULL DEFAULT 0,
  monthly_expenses bigint NOT NULL DEFAULT 0,
  vacancy_bps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER portfolio_updated BEFORE UPDATE ON public.portfolio_properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.portfolio_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portfolio_property_id uuid NOT NULL REFERENCES public.portfolio_properties(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount bigint NOT NULL,
  occurred_on date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.portfolio_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portfolio_property_id uuid NOT NULL REFERENCES public.portfolio_properties(id) ON DELETE CASCADE,
  value bigint NOT NULL,
  mortgage_balance bigint,
  valued_on date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER portfolio_valuations_append_only BEFORE UPDATE ON public.portfolio_valuations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TABLE public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investor_profile_id uuid REFERENCES public.investor_profiles(id) ON DELETE SET NULL,
  query text NOT NULL,
  generated_queries text[],
  status text NOT NULL DEFAULT 'completed',
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  search_id uuid NOT NULL REFERENCES public.searches(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  deal_priority integer,
  match_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  kind text NOT NULL,
  provider text NOT NULL,
  model text,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  model text,
  tokens_input integer,
  tokens_output integer,
  estimated_cost numeric,
  tool_calls integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['investor_profiles','investment_analyses','calculation_scenarios','portfolio_properties','portfolio_transactions','portfolio_valuations','watchlist','alerts','searches','search_results','ai_analyses','ai_usage','audit_logs'] LOOP
    EXECUTE format('CREATE INDEX ON public.%I(user_id)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own select" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "own insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['investor_profiles','calculation_scenarios','portfolio_properties','portfolio_transactions','watchlist','alerts','searches'] LOOP
    EXECUTE format('CREATE POLICY "own update" ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "own delete" ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t);
  END LOOP;
END $$;
CREATE TRIGGER investor_profiles_updated BEFORE UPDATE ON public.investor_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== SAMPLE DATA (is_sample = true) =====
INSERT INTO public.market_statistics (city, period, avg_asking_price_m2, avg_rent_m2, listings_count, is_sample) VALUES
('Praha','2026-09-01',142000,420,4120,true),('Brno','2026-09-01',112000,340,1650,true),
('Pardubice','2026-09-01',82000,285,410,true),('Hradec Králové','2026-09-01',88000,290,380,true),
('Plzeň','2026-09-01',86000,280,520,true),('Olomouc','2026-09-01',84000,275,350,true),
('Ostrava','2026-09-01',52000,215,890,true),('Kladno','2026-09-01',70000,260,240,true),
('Praha','2026-06-01',139000,410,4050,true),('Brno','2026-06-01',110000,332,1600,true),
('Pardubice','2026-06-01',80000,280,400,true),('Hradec Králové','2026-06-01',86500,286,370,true),
('Plzeň','2026-06-01',84500,276,510,true),('Olomouc','2026-06-01',82500,270,340,true),
('Ostrava','2026-06-01',51000,212,880,true),('Kladno','2026-06-01',68500,255,235,true),
('Praha','2026-03-01',136000,402,3990,true),('Brno','2026-03-01',108000,326,1580,true),
('Pardubice','2026-03-01',78500,276,395,true),('Hradec Králové','2026-03-01',85000,282,365,true),
('Plzeň','2026-03-01',83000,272,500,true),('Olomouc','2026-03-01',81000,266,335,true),
('Ostrava','2026-03-01',50000,208,870,true),('Kladno','2026-03-01',67000,250,230,true);

WITH p AS (
  INSERT INTO public.properties (id, is_sample, property_type, disposition, area_m2, city, district, address, latitude, longitude, condition, building_type, floor, energy_class, description) VALUES
  ('00000000-0000-4000-a000-000000000001',true,'byt','2+kk',52,'Pardubice','Polabiny','Kosmonautů (ukázka)',50.0469,15.7556,'po rekonstrukci','panel',4,'C','UKÁZKOVÁ DATA. Byt po rekonstrukci, blízko MHD.'),
  ('00000000-0000-4000-a000-000000000002',true,'byt','3+1',74,'Pardubice','Zelené Předměstí','Družstevní (ukázka)',50.0322,15.7700,'původní stav','cihla',2,'D','UKÁZKOVÁ DATA. Cihlový byt k rekonstrukci.'),
  ('00000000-0000-4000-a000-000000000003',true,'byt','1+kk',31,'Praha','Žižkov','Seifertova (ukázka)',50.0840,14.4500,'dobrý','cihla',3,'D','UKÁZKOVÁ DATA. Malometrážní byt v centru.'),
  ('00000000-0000-4000-a000-000000000004',true,'byt','2+kk',58,'Praha','Holešovice','Komunardů (ukázka)',50.1030,14.4490,'novostavba','novostavba',5,'B','UKÁZKOVÁ DATA. Novostavba s balkonem.'),
  ('00000000-0000-4000-a000-000000000005',true,'byt','2+1',60,'Brno','Královo Pole','Palackého (ukázka)',49.2160,16.5960,'dobrý','cihla',1,'C','UKÁZKOVÁ DATA.'),
  ('00000000-0000-4000-a000-000000000006',true,'byt','3+kk',81,'Brno','Žabovřesky','Minská (ukázka)',49.2100,16.5800,'po rekonstrukci','cihla',3,'C','UKÁZKOVÁ DATA.'),
  ('00000000-0000-4000-a000-000000000007',true,'byt','2+1',55,'Hradec Králové','Moravské Předměstí','Brněnská (ukázka)',50.2000,15.8500,'původní stav','panel',6,'D','UKÁZKOVÁ DATA.'),
  ('00000000-0000-4000-a000-000000000008',true,'byt','1+1',38,'Plzeň','Slovany','Slovanská (ukázka)',49.7300,13.3900,'dobrý','panel',2,'C','UKÁZKOVÁ DATA.'),
  ('00000000-0000-4000-a000-000000000009',true,'byt','3+1',70,'Olomouc','Nová Ulice','Zikova (ukázka)',49.5900,17.2400,'po rekonstrukci','cihla',2,'C','UKÁZKOVÁ DATA.'),
  ('00000000-0000-4000-a000-000000000010',true,'byt','2+1',56,'Ostrava','Poruba','Hlavní třída (ukázka)',49.8300,18.1600,'původní stav','cihla',3,'D','UKÁZKOVÁ DATA. Vysoký hrubý výnos.'),
  ('00000000-0000-4000-a000-000000000011',true,'byt','3+1',68,'Ostrava','Zábřeh','Jubilejní (ukázka)',49.8000,18.2400,'dobrý','panel',8,'C','UKÁZKOVÁ DATA.'),
  ('00000000-0000-4000-a000-000000000012',true,'byt','2+kk',48,'Kladno','Kročehlavy','Americká (ukázka)',50.1400,14.0900,'dobrý','panel',5,'C','UKÁZKOVÁ DATA.')
  RETURNING id
) SELECT count(*) FROM p;

INSERT INTO public.listings (id, property_id, is_sample, source_url, source_domain, title, first_seen_at, last_seen_at, last_verified_at, source_published_at, price, area_m2, rooms, property_type, location, address, latitude, longitude, availability_status, availability_confidence, freshness_status, freshness_score) VALUES
('10000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001',true,'https://example.com/sample/pardubice-2kk-52','example.com','Prodej bytu 2+kk 52 m² (ukázka)',now()-interval '3 days',now()-interval '2 hours',now()-interval '2 hours',now()-interval '3 days',4290000,52,'2+kk','byt','Pardubice','Kosmonautů',50.0469,15.7556,'ACTIVE_CONFIRMED',0.92,'FRESH',95),
('10000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000002',true,'https://example.com/sample/pardubice-3-1-74','example.com','Prodej bytu 3+1 74 m² (ukázka)',now()-interval '20 days',now()-interval '1 day',now()-interval '1 day',now()-interval '20 days',5490000,74,'3+1','byt','Pardubice','Družstevní',50.0322,15.7700,'ACTIVE_CONFIRMED',0.85,'RECENT',78),
('10000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000003',true,'https://example.com/sample/praha-1kk-31','example.com','Prodej bytu 1+kk 31 m² (ukázka)',now()-interval '6 days',now()-interval '5 hours',now()-interval '5 hours',now()-interval '6 days',5190000,31,'1+kk','byt','Praha','Seifertova',50.0840,14.4500,'ACTIVE_CONFIRMED',0.9,'FRESH',90),
('10000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000004',true,'https://example.com/sample/praha-2kk-58','example.com','Prodej bytu 2+kk 58 m² (ukázka)',now()-interval '12 days',now()-interval '2 days',now()-interval '2 days',now()-interval '12 days',10490000,58,'2+kk','byt','Praha','Komunardů',50.1030,14.4490,'ACTIVE_UNCONFIRMED',0.6,'RECENT',70),
('10000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000005',true,'https://example.com/sample/brno-2-1-60','example.com','Prodej bytu 2+1 60 m² (ukázka)',now()-interval '9 days',now()-interval '1 day',now()-interval '1 day',now()-interval '9 days',6190000,60,'2+1','byt','Brno','Palackého',49.2160,16.5960,'ACTIVE_CONFIRMED',0.88,'RECENT',80),
('10000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000006',true,'https://example.com/sample/brno-3kk-81','example.com','Prodej bytu 3+kk 81 m² (ukázka)',now()-interval '45 days',now()-interval '16 days',now()-interval '16 days',now()-interval '45 days',9990000,81,'3+kk','byt','Brno','Minská',49.2100,16.5800,'ACTIVE_UNCONFIRMED',0.4,'STALE',30),
('10000000-0000-4000-a000-000000000007','00000000-0000-4000-a000-000000000007',true,'https://example.com/sample/hk-2-1-55','example.com','Prodej bytu 2+1 55 m² (ukázka)',now()-interval '14 days',now()-interval '6 hours',now()-interval '6 hours',now()-interval '14 days',4190000,55,'2+1','byt','Hradec Králové','Brněnská',50.2000,15.8500,'ACTIVE_CONFIRMED',0.9,'FRESH',88),
('10000000-0000-4000-a000-000000000008','00000000-0000-4000-a000-000000000008',true,'https://example.com/sample/plzen-1-1-38','example.com','Prodej bytu 1+1 38 m² (ukázka)',now()-interval '30 days',now()-interval '8 days',now()-interval '8 days',now()-interval '30 days',3390000,38,'1+1','byt','Plzeň','Slovanská',49.7300,13.3900,'RESERVED',0.8,'AGING',50),
('10000000-0000-4000-a000-000000000009','00000000-0000-4000-a000-000000000009',true,'https://example.com/sample/olomouc-3-1-70','example.com','Prodej bytu 3+1 70 m² (ukázka)',now()-interval '60 days',now()-interval '1 day',now()-interval '1 day',now()-interval '2 days',5590000,70,'3+1','byt','Olomouc','Zikova',49.5900,17.2400,'ACTIVE_CONFIRMED',0.8,'RECENT',75),
('10000000-0000-4000-a000-000000000010','00000000-0000-4000-a000-000000000010',true,'https://example.com/sample/ostrava-2-1-56','example.com','Prodej bytu 2+1 56 m² (ukázka)',now()-interval '4 days',now()-interval '3 hours',now()-interval '3 hours',now()-interval '4 days',2390000,56,'2+1','byt','Ostrava','Hlavní třída',49.8300,18.1600,'ACTIVE_CONFIRMED',0.9,'FRESH',92),
('10000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000011',true,'https://example.com/sample/ostrava-3-1-68','example.com','Prodej bytu 3+1 68 m² (ukázka)',now()-interval '90 days',now()-interval '40 days',now()-interval '1 day',now()-interval '90 days',3590000,68,'3+1','byt','Ostrava','Jubilejní',49.8000,18.2400,'REMOVED',0.7,'EXPIRED',5),
('10000000-0000-4000-a000-000000000012','00000000-0000-4000-a000-000000000012',true,'https://example.com/sample/kladno-2kk-48','example.com','Prodej bytu 2+kk 48 m² (ukázka)',now()-interval '7 days',now()-interval '12 hours',now()-interval '12 hours',now()-interval '7 days',3290000,48,'2+kk','byt','Kladno','Americká',50.1400,14.0900,'ACTIVE_CONFIRMED',0.85,'FRESH',85),
-- duplicate listing of property 1 from another source
('10000000-0000-4000-a000-000000000013','00000000-0000-4000-a000-000000000001',true,'https://agency.example.org/sample/pce-2kk','agency.example.org','RK nabídka 2+kk Pardubice (ukázka, duplicita)',now()-interval '2 days',now()-interval '1 day',now()-interval '1 day',now()-interval '2 days',4350000,52,'2+kk','byt','Pardubice','Kosmonautů',50.0469,15.7556,'ACTIVE_UNCONFIRMED',0.6,'RECENT',72);

-- price history (append-only)
INSERT INTO public.listing_snapshots (listing_id, price, availability_status, observed_at) VALUES
('10000000-0000-4000-a000-000000000001',4490000,'ACTIVE_CONFIRMED',now()-interval '3 days'),
('10000000-0000-4000-a000-000000000001',4290000,'ACTIVE_CONFIRMED',now()-interval '2 hours'),
('10000000-0000-4000-a000-000000000002',5690000,'ACTIVE_CONFIRMED',now()-interval '20 days'),
('10000000-0000-4000-a000-000000000002',5490000,'ACTIVE_CONFIRMED',now()-interval '1 day'),
('10000000-0000-4000-a000-000000000004',9990000,'ACTIVE_CONFIRMED',now()-interval '12 days'),
('10000000-0000-4000-a000-000000000004',10490000,'ACTIVE_UNCONFIRMED',now()-interval '2 days'),
('10000000-0000-4000-a000-000000000009',5790000,'ACTIVE_CONFIRMED',now()-interval '60 days'),
('10000000-0000-4000-a000-000000000009',5790000,'REMOVED',now()-interval '30 days'),
('10000000-0000-4000-a000-000000000009',5590000,'ACTIVE_CONFIRMED',now()-interval '2 days'),
('10000000-0000-4000-a000-000000000010',2490000,'ACTIVE_CONFIRMED',now()-interval '4 days'),
('10000000-0000-4000-a000-000000000010',2390000,'ACTIVE_CONFIRMED',now()-interval '3 hours'),
('10000000-0000-4000-a000-000000000011',3590000,'ACTIVE_CONFIRMED',now()-interval '90 days'),
('10000000-0000-4000-a000-000000000011',3590000,'REMOVED',now()-interval '1 day');

INSERT INTO public.listing_freshness_events (listing_id, event_type, http_status, previous_status, new_status, freshness_status, details) VALUES
('10000000-0000-4000-a000-000000000001','price_decrease',200,'ACTIVE_CONFIRMED','ACTIVE_CONFIRMED','FRESH','{"from":4490000,"to":4290000}'),
('10000000-0000-4000-a000-000000000009','reappeared',200,'REMOVED','ACTIVE_CONFIRMED','RECENT','{}'),
('10000000-0000-4000-a000-000000000011','not_found',404,'ACTIVE_CONFIRMED','REMOVED','EXPIRED','{"note":"404 neznamená prodáno"}'),
('10000000-0000-4000-a000-000000000008','status_marker',200,'ACTIVE_CONFIRMED','RESERVED','AGING','{"marker":"rezervováno"}'),
('10000000-0000-4000-a000-000000000006','verification_failed',503,'ACTIVE_CONFIRMED','ACTIVE_UNCONFIRMED','STALE','{"note":"dočasná chyba"}');
