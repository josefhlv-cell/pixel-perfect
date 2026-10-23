ALTER TABLE public.listings ADD COLUMN offer_type text NOT NULL DEFAULT 'prodej';
ALTER TABLE public.listings ADD CONSTRAINT listings_offer_type_check CHECK (offer_type IN ('prodej', 'pronajem'));
COMMENT ON COLUMN public.listings.offer_type IS 'Typ nabídky: prodej (cena = kupní cena) nebo pronajem (cena = měsíční nájemné bez služeb). Existující řádky byly získány jako prodejní inzeráty.';