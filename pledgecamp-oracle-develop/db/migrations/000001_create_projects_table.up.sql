CREATE TABLE IF NOT EXISTS project
(
    id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    completed_at timestamp without time zone,
    status integer NOT NULL,
    next_activity_date timestamp without time zone,
    contract_address text COLLATE pg_catalog."default",
    activities_completed text[] COLLATE pg_catalog."default",
    project_param jsonb,
    CONSTRAINT project_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;