CREATE TABLE gender (
    gender_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gender_name VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO gender (gender_name) VALUES
('Male'),
('Female'),
('Non-Binary'),
('Other'),
('Prefer Not to Say');

CREATE TABLE marital_status (
    marital_status_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    marital_status_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO marital_status (marital_status_name) VALUES
('Single'),
('Married'),
('Divorced'),
('Widowed'),
('Separated');

CREATE TABLE education_level (
    education_level_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    education_level_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO education_level (education_level_name) VALUES
('No Formal Education'),
('Primary School'),
('Secondary School'),
('Higher Secondary'),
('Diploma'),
('Undergraduate'),
('Postgraduate'),
('Doctorate');

CREATE TABLE occupation (
    occupation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occupation_name VARCHAR(100) NOT NULL UNIQUE,
    occupation_category VARCHAR(100)
);

INSERT INTO occupation (occupation_name, occupation_category) VALUES
('Salaried Employee', 'Employment'),
('Self-Employed Professional', 'Self-Employment'),
('Business Owner', 'Self-Employment'),
('Freelancer', 'Self-Employment'),
('Government Employee', 'Employment'),
('Retired', 'Non-Active'),
('Student', 'Non-Active'),
('Unemployed', 'Non-Active'),
('Agricultural Worker', 'Agriculture'),
('Homemaker', 'Non-Active');

CREATE TABLE employment_types (
    employment_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employment_type_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO employment_types (employment_type_name) VALUES
('Full-Time'),
('Part-Time'),
('Contract'),
('Freelance'),
('Self-Employed'),
('Unemployed'),
('Retired'),
('Student');

CREATE TABLE income_types (
    income_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    income_type_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO income_types (income_type_name) VALUES
('Salary'),
('Business Income'),
('Rental Income'),
('Investment Income'),
('Agricultural Income'),
('Pension'),
('Other');

CREATE TABLE account_types (
    account_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_type_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO account_types (account_type_name) VALUES
('Savings Account'),
('Current Account'),
('Salary Account'),
('NRE Account'),
('NRO Account'),
('Fixed Deposit'),
('No Bank Account');

CREATE TABLE loan_types (
    loan_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loan_type_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO loan_types (loan_type_name) VALUES
('Personal Loan'),
('Home Loan'),
('Car Loan'),
('Education Loan'),
('Business Loan'),
('Gold Loan'),
('Agricultural Loan'),
('Two Wheeler Loan'),
('Consumer Durable Loan'),
('Medical Loan'),
('Travel Loan'),
('Wedding Loan'),
('Mortgage Loan');

CREATE TABLE repayment (
    repayment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    repayment_mode VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO repayment (repayment_mode) VALUES
('EMI'),
('Bullet Repayment'),
('Quarterly'),
('Bi-Annual'),
('Annual');

CREATE TABLE states (
    state_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL UNIQUE,
    state_code VARCHAR(3) NOT NULL UNIQUE
);

INSERT INTO states (state_name, state_code) VALUES
('Andhra Pradesh', 'AP'),
('Arunachal Pradesh', 'AR'),
('Assam', 'AS'),
('Bihar', 'BR'),
('Chhattisgarh', 'CG'),
('Goa', 'GA'),
('Gujarat', 'GJ'),
('Haryana', 'HR'),
('Himachal Pradesh', 'HP'),
('Jharkhand', 'JH'),
('Karnataka', 'KA'),
('Kerala', 'KL'),
('Madhya Pradesh', 'MP'),
('Maharashtra', 'MH'),
('Manipur', 'MN'),
('Meghalaya', 'ML'),
('Mizoram', 'MZ'),
('Nagaland', 'NL'),
('Odisha', 'OD'),
('Punjab', 'PB'),
('Rajasthan', 'RJ'),
('Sikkim', 'SK'),
('Tamil Nadu', 'TN'),
('Telangana', 'TS'),
('Tripura', 'TR'),
('Uttar Pradesh', 'UP'),
('Uttarakhand', 'UK'),
('West Bengal', 'WB'),
('Delhi', 'DL'),
('Jammu and Kashmir', 'JK'),
('Ladakh', 'LA'),
('Puducherry', 'PY'),
('Chandigarh', 'CH'),
('Andaman and Nicobar Islands', 'AN'),
('Dadra and Nagar Haveli and Daman and Diu', 'DD'),
('Lakshadweep', 'LD');

CREATE TABLE analysts (
    analyst_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supabase_user_id UUID UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(15),
    department VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'Analyst',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE applicants (
    applicant_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supabase_user_id UUID UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    gender_id BIGINT REFERENCES gender(gender_id),
    marital_status_id BIGINT REFERENCES marital_status(marital_status_id),
    education_level_id BIGINT REFERENCES education_level(education_level_id),
    pan_number VARCHAR(10) UNIQUE,
    aadhaar_number VARCHAR(12) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100) NOT NULL,
    state_id BIGINT REFERENCES states(state_id),
    pincode VARCHAR(6) NOT NULL,
    occupation_id BIGINT REFERENCES occupation(occupation_id),
    employer_name VARCHAR(255),
    employment_type_id BIGINT REFERENCES employment_types(employment_type_id),
    monthly_income NUMERIC(15, 2) NOT NULL,
    income_type_id BIGINT REFERENCES income_types(income_type_id),
    account_type_id BIGINT REFERENCES account_types(account_type_id),
    bank_name VARCHAR(255),
    account_number VARCHAR(20),
    ifsc_code VARCHAR(11),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE applications (
    application_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_number VARCHAR(20) NOT NULL UNIQUE,
    applicant_id BIGINT NOT NULL REFERENCES applicants(applicant_id),
    loan_type_id BIGINT NOT NULL REFERENCES loan_types(loan_type_id),
    loan_amount_requested NUMERIC(15, 2) NOT NULL,
    loan_tenure_months INT NOT NULL,
    loan_purpose TEXT,
    repayment_id BIGINT REFERENCES repayment(repayment_id),
    status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    assigned_analyst_id BIGINT REFERENCES analysts(analyst_id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    decision_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credit_enquiries (
    enquiry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES applications(application_id),
    applicant_id BIGINT NOT NULL REFERENCES applicants(applicant_id),
    bureau_name VARCHAR(100) NOT NULL,
    credit_score INT NOT NULL,
    enquiry_date DATE NOT NULL,
    report_reference VARCHAR(255),
    raw_response JSONB,
    total_accounts INT,
    active_accounts INT,
    closed_accounts INT,
    total_outstanding NUMERIC(15, 2),
    total_overdue NUMERIC(15, 2),
    enquiries_last_6m INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE delinquencies (
    delinquency_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enquiry_id BIGINT NOT NULL REFERENCES credit_enquiries(enquiry_id),
    applicant_id BIGINT NOT NULL REFERENCES applicants(applicant_id),
    creditor_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(100),
    overdue_amount NUMERIC(15, 2) NOT NULL,
    days_past_due INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    delinquency_date DATE NOT NULL,
    settlement_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    document_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES applications(application_id),
    applicant_id BIGINT NOT NULL REFERENCES applicants(applicant_id),
    document_type VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    verified_by BIGINT REFERENCES analysts(analyst_id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_assessments (
    assessment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT NOT NULL UNIQUE REFERENCES applications(application_id),
    overall_score NUMERIC(5, 2),
    risk_category VARCHAR(20),
    recommendation VARCHAR(20),
    debt_to_income_ratio NUMERIC(5, 4),
    loan_to_income_ratio NUMERIC(5, 4),
    credit_score_used INT,
    assessed_by VARCHAR(50) NOT NULL DEFAULT 'AI',
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    assessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_factors (
    factor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES risk_assessments(assessment_id),
    factor_name VARCHAR(100) NOT NULL,
    factor_value TEXT NOT NULL,
    factor_score NUMERIC(5, 2),
    impact VARCHAR(10) NOT NULL,
    weight NUMERIC(5, 4),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
