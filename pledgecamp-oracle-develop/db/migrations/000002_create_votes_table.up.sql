CREATE TABLE IF NOT EXISTS votes
(
    vote_id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    vote_created_at timestamp without time zone NOT NULL,
    contract_address text COLLATE pg_catalog."default",
    user_id integer,
    fk_project_id integer NOT NULL,
    vote_param jsonb,
    CONSTRAINT vote_pkey PRIMARY KEY (vote_id),
    CONSTRAINT fk_project_id FOREIGN KEY (fk_project_id) REFERENCES project(id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;
