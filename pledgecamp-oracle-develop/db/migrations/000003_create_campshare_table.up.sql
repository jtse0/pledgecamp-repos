CREATE TABLE IF NOT EXISTS campshare
(
    cs_id integer NOT NULL,
    contract_address text COLLATE pg_catalog."default",
    created_at timestamp without time zone,
    cs_type integer,
    user_id integer,
    amount integer,
    balance_movement integer,
    unstake_complete_date timestamp without time zone,
    cs_param jsonb,
    CONSTRAINT campshare_pkey PRIMARY KEY (cs_id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;
