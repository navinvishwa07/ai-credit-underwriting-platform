const express = require('express');
const supabase = require('./config/supabase');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

const CURRENT_APPLICANT_ID = 1;

app.get('/customer/dashboard', async (req, res) => {
    try {
        const { data: applicant, error: applicantError } = await supabase
            .from('applicants')
            .select('first_name, last_name')
            .eq('applicant_id', CURRENT_APPLICANT_ID)
            .single();

        if (applicantError) throw applicantError;

        const { data: applications, error: appsError } = await supabase
            .from('applications')
            .select(`
                application_id,
                application_number,
                loan_amount_requested,
                status,
                submitted_at,
                loan_types ( loan_type_name )
            `)
            .eq('applicant_id', CURRENT_APPLICANT_ID)
            .order('submitted_at', { ascending: false });

        if (appsError) throw appsError;

        const loanSummary = {
            totalApplications: applications.length,
            underReview: applications.filter(a =>
                ['Submitted', 'Under Review', 'Pending'].includes(a.status)
            ).length,
            approvedApplications: applications.filter(a => a.status === 'Approved').length,
            rejectedApplications: applications.filter(a => a.status === 'Rejected').length
        };

        const recentApplications = applications.slice(0, 5).map(a => ({
            applicationID: a.application_number,
            loanType: a.loan_types?.loan_type_name || '—',
            applicationDate: new Date(a.submitted_at).toLocaleDateString('en-IN'),
            amount: a.loan_amount_requested,
            status: a.status
        }));

        const customer = {
            name: `${applicant.first_name} ${applicant.last_name}`
        };

        res.render('customer/customer_dashboard', {
            customer,
            loanSummary,
            recentApplications
        });

    } catch (err) {
        console.error('Dashboard error:', err.message);
        res.status(500).send('Could not load dashboard. Please try again later.');
    }
});

app.get('/customer/profile', async (req, res) => {
    try {
        const { data: row, error } = await supabase
            .from('applicants')
            .select(`
                first_name,
                middle_name,
                last_name,
                dob,
                pan_number,
                aadhaar_number,
                email,
                phone,
                address_line1,
                address_line2,
                city,
                pincode,
                employer_name,
                monthly_income,
                bank_name,
                account_number,
                created_at,
                gender ( gender_name ),
                states ( state_name ),
                occupation ( occupation_name ),
                employment_types ( employment_type_name )
            `)
            .eq('applicant_id', CURRENT_APPLICANT_ID)
            .single();

        if (error) throw error;

        const customer = {
            name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
            email: row.email,
            phone: row.phone,
            address: [row.address_line1, row.address_line2].filter(Boolean).join(', '),
            city: row.city,
            state: row.states?.state_name || '—',
            pincode: row.pincode,
            dob: row.dob ? new Date(row.dob) : null,
            gender: row.gender?.gender_name || '—',
            pan: row.pan_number || '—',
            aadhaar: row.aadhaar_number || '—',
            occupation: row.occupation?.occupation_name || '—',
            employer: row.employer_name || '—',
            employmentType: row.employment_types?.employment_type_name || '—',
            annualIncome: row.monthly_income
                ? (row.monthly_income * 12).toLocaleString('en-IN')
                : '—',
            bankName: row.bank_name || '—',
            accountNumber: row.account_number || '—',
            accountCreated: new Date(row.created_at)
        };

        res.render('customer/customer_profile', { customer });

    } catch (err) {
        console.error('Profile error:', err.message);
        res.status(500).send('Could not load profile. Please try again later.');
    }
});

app.get('/customer/loan-status', async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('applications')
            .select(`
                application_id,
                application_number,
                loan_amount_requested,
                status,
                submitted_at,
                loan_types ( loan_type_name )
            `)
            .eq('applicant_id', CURRENT_APPLICANT_ID)
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        const applications = rows.map(a => ({
            applicationID: a.application_number,
            loanType: a.loan_types?.loan_type_name || '—',
            applicationDate: new Date(a.submitted_at).toLocaleDateString('en-IN'),
            amount: a.loan_amount_requested,
            status: a.status
        }));

        res.render('customer/application_tracker', { applications });

    } catch (err) {
        console.error('Loan status error:', err.message);
        res.status(500).send('Could not load loan status. Please try again later.');
    }
});

app.get('/customer/apply-loan', (req, res) => {
    res.render('loan_application/step1_personalInfo');
});

app.get('/customer/apply-loan/step2', (req, res) => {
    res.render('loan_application/step2_loanDetails');
});

app.get('/customer/apply-loan/step3', (req, res) => {
    res.render('loan_application/step3_employmentDetails');
});

app.get('/customer/apply-loan/step4', (req, res) => {
    res.render('loan_application/step4_financialInformation');
});

app.get('/customer/apply-loan/step5', (req, res) => {
    res.render('loan_application/step5_creditInformation');
});

app.get('/customer/apply-loan/step6', (req, res) => {
    const applicationReview = {
        personal: {
            name: 'Navin Vishwa',
            dob: '15 July 1990',
            pan: 'ABCDE1234F',
            email: 'navin.vishwa@example.com',
            phone: '9876543210',
            address: '123 Green Avenue, Sector 45, Bengaluru, Karnataka, 560034'
        },
        loan: {
            amount: '5,00,000',
            type: 'Home Loan',
            purpose: 'Home renovation',
            tenure: 60
        },
        employment: {
            employer: 'Rupya AI Technologies',
            monthlyIncome: '80,000',
            experience: 6
        },
        financial: {
            currentEmi: '15,000',
            outstandingLoans: '2,50,000',
            savings: '1,20,000',
            assets: 'Property, Fixed Deposits'
        },
        credit: {
            cards: 2,
            defaults: 'No',
            consent: 'Yes'
        }
    };

    res.render('loan_application/step6_reviewSubmit', { applicationReview });
});

app.post('/customer/apply-loan/submit', async (req, res) => {
    try {
        const {
            loan_type_id,
            loan_amount_requested,
            loan_tenure_months,
            loan_purpose,
            repayment_id
        } = req.body;

        const appNumber = `RU${new Date().getFullYear()}${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

        const { data, error } = await supabase
            .from('applications')
            .insert({
                application_number: appNumber,
                applicant_id: CURRENT_APPLICANT_ID,
                loan_type_id: parseInt(loan_type_id),
                loan_amount_requested: parseFloat(loan_amount_requested),
                loan_tenure_months: parseInt(loan_tenure_months),
                loan_purpose: loan_purpose || null,
                repayment_id: repayment_id ? parseInt(repayment_id) : null,
                status: 'Submitted'
            })
            .select()
            .single();

        if (error) throw error;

        const applicationResult = {
            applicationId: data.application_number,
            status: data.status,
            nextSteps: [
                'Document Verification',
                'AI Risk Assessment',
                'Analyst Review',
                'Decision'
            ]
        };

        res.render('loan_application/application_success', { applicationResult });

    } catch (err) {
        console.error('Submit error:', err.message);
        res.status(500).send('Could not submit application. Please try again.');
    }
});

app.get('/customer/apply-loan/success', (req, res) => {
    const applicationResult = {
        applicationId: 'RU2026000215',
        status: 'Submitted',
        nextSteps: [
            'Document Verification',
            'AI Risk Assessment',
            'Analyst Review',
            'Decision'
        ]
    };
    res.render('loan_application/application_success', { applicationResult });
});

app.get('/customer/application-success', (req, res) => {
    const application = {
        applicationID: 100245,
        loanType: 'Personal Loan',
        amount: 500000,
        applicationDate: '18 June 2026'
    };
    res.render('loan_application/application_success', { application });
});

app.listen(3000, () => {
    console.log('Rupya AI server running on http://localhost:3000');
});