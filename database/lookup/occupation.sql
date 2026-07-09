CREATE TABLE occupation (

    occupation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occupation_name VARCHAR(50) NOT NULL UNIQUE

);

INSERT INTO occupation (occupation_name)
VALUES
('Engineering & Technology'),
('Healthcare'),
('Education'),
('Finance & Accounting'),
('Legal'),
('Sales & Marketing'),
('Business & Management'),
('Government Services'),
('Defense & Security'),
('Agriculture'),
('Construction'),
('Manufacturing'),
('Transportation & Logistics'),
('Hospitality & Tourism'),
('Retail & Customer Service'),
('Arts, Media & Entertainment'),
('Student'),
('Homemaker'),
('Retired'),
('Unemployed'),
('Other');