CREATE TABLE marital_status (
    marital_status_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    marital_status_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO marital_status (marital_status_name) VALUES
('Single'),
('Married'),
('Divorced'),
('Widowed'),
('Separated'),
('In a relationship');