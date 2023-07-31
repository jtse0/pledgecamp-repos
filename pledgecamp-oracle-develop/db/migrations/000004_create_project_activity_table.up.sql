CREATE TABLE IF NOT EXISTS project_activity
(
    project_activity_id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    fk_project_id integer,
    created_at timestamp without time zone NOT NULL,
    modified_at timestamp without time zone,
    transaction_hash text,
    activity_status integer NOT NULL,
    activity_type text NOT NULL,
    CONSTRAINT activity_pkey PRIMARY KEY (project_activity_id)

)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;


