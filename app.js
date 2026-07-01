const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const supabase = require('./config/supabase');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET || 'rupya-ai-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

function isAnalyst(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.role !== 'customer') {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/analyst/login');
}

function isCustomer(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'customer') {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/customer/login');
}

app.get('/analyst/login', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return res.redirect('/analyst/dashboard');
    }

    const errorMessage = req.session.loginError || null;
    delete req.session.loginError;

    res.render('analyst/analyst_login', {
        pageTitle: 'Analyst Login | Rupya AI',
        errorMessage
    });
});

app.post('/analyst/login', (req, res, next) => {
    passport.authenticate('analyst-local', (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            req.session.loginError = info?.message || 'Invalid credentials.';
            return res.redirect('/analyst/login');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);

            const returnTo = req.session.returnTo || '/analyst/dashboard';
            delete req.session.returnTo;
            res.redirect(returnTo);
        });
    })(req, res, next);
});

app.get('/analyst/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.redirect('/analyst/login');
        });
    });
});

app.get('/customer/login', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'customer') {
        return res.redirect('/customer/dashboard');
    }

    const errorMessage = req.session.loginError || null;
    delete req.session.loginError;

    res.render('customer/customer_login', { errorMessage });
});

app.post('/customer/login', (req, res, next) => {
    passport.authenticate('customer-local', (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            req.session.loginError = info?.message || 'Invalid credentials.';
            return res.redirect('/customer/login');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);

            const returnTo = req.session.returnTo || '/customer/dashboard';
            delete req.session.returnTo;
            res.redirect(returnTo);
        });
    })(req, res, next);
});

app.get('/customer/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.redirect('/customer/login');
        });
    });
});

app.get('/analyst/dashboard', isAnalyst, async (req, res) => {
    try {
        const { data: applications, error } = await supabase
            .from('applications')
            .select(`
                application_id,
                application_number,
                loan_amount_requested,
                status,
                submitted_at,
                applicants ( first_name, last_name ),
                loan_types ( loan_type_name )
            `)
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        const stats = {
            total: applications.length,
            pending: applications.filter(a => ['Submitted', 'Under Review'].includes(a.status)).length,
            approved: applications.filter(a => a.status === 'Approved').length,
            rejected: applications.filter(a => a.status === 'Rejected').length,
        };

        res.render('analyst/analyst_dashboard', {
            analyst: req.user,
            applications,
            stats
        });

    } catch (err) {
        console.error('Analyst dashboard error:', err.message);
        res.status(500).send('Could not load analyst dashboard.');
    }
});

app.get('/analyst/applications', isAnalyst, (req, res) => {
    res.redirect('/analyst/dashboard');
});

app.get('/analyst/applications/:id/review', isAnalyst, async (req, res) => {
    const appId = parseInt(req.params.id, 10);

    try {
        const { data: application, error: appError } = await supabase
            .from('applications')
            .select(`
                application_id,
                application_number,
                loan_amount_requested,
                loan_tenure_months,
                loan_purpose,
                status,
                submitted_at,
                reviewed_at,
                decided_at,
                decision_notes,
                applicant_id,
                loan_types ( loan_type_name ),
                repayment  ( repayment_mode )
            `)
            .eq('application_id', appId)
            .single();

        if (appError || !application) {
            return res.status(404).send('Application not found.');
        }

        const { data: applicant, error: applicantError } = await supabase
            .from('applicants')
            .select(`
                applicant_id,
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
                ifsc_code,
                gender           ( gender_name ),
                states           ( state_name ),
                occupation       ( occupation_name ),
                employment_types ( employment_type_name ),
                income_types     ( income_type_name ),
                account_types    ( account_type_name ),
                education_level  ( education_level_name )
            `)
            .eq('applicant_id', application.applicant_id)
            .single();

        if (applicantError) throw applicantError;

        const { data: creditRows } = await supabase
            .from('credit_enquiries')
            .select('*')
            .eq('application_id', appId)
            .order('created_at', { ascending: false })
            .limit(1);

        const creditEnquiry = creditRows?.[0] || null;

        const { data: riskRows } = await supabase
            .from('risk_assessments')
            .select('*')
            .eq('application_id', appId)
            .limit(1);

        const riskAssessment = riskRows?.[0] || null;

        if (application.status === 'Submitted') {
            await supabase
                .from('applications')
                .update({
                    status: 'Under Review',
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('application_id', appId);

            application.status = 'Under Review';
        }

        res.render('analyst/analyst_review', {
            analyst: req.user,
            application,
            applicant,
            creditEnquiry,
            riskAssessment
        });

    } catch (err) {
        console.error('Review error:', err.message);
        res.status(500).send('Could not load application review.');
    }
});

app.post('/analyst/applications/:id/decide', isAnalyst, async (req, res) => {
    const appId = parseInt(req.params.id, 10);
    const { decision, decision_notes } = req.body;

    if (!['Approved', 'Rejected'].includes(decision)) {
        return res.status(400).send('Invalid decision value.');
    }

    if (!decision_notes || decision_notes.trim().length === 0) {
        return res.status(400).send('Analyst remarks are required.');
    }

    try {
        const { data: updated, error } = await supabase
            .from('applications')
            .update({
                status: decision,
                decision_notes: decision_notes.trim(),
                assigned_analyst_id: req.user.analyst_id,
                decided_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('application_id', appId)
            .select('application_number, status')
            .single();

        if (error) throw error;

        res.redirect(`/analyst/applications/${appId}/review`);

    } catch (err) {
        console.error('Decision error:', err.message);
        res.status(500).send('Could not save decision. Please try again.');
    }
});

app.get('/customer/dashboard', isCustomer, async (req, res) => {
    try {
        const { data: applicant, error: applicantError } = await supabase
            .from('applicants')
            .select('first_name, last_name')
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        if (applicantError) throw applicantError;
        if (!applicant) return res.status(404).send('Applicant not found.');

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
            .eq('applicant_id', req.user.applicant_id)
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

app.get('/customer/profile', isCustomer, async (req, res) => {
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
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        if (error) throw error;
        if (!row) return res.status(404).send('Applicant not found.');

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

app.get('/customer/loan-status', isCustomer, async (req, res) => {
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
            .eq('applicant_id', req.user.applicant_id)
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

app.get('/customer/apply-loan', isCustomer, (req, res) => {
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

app.post('/customer/apply-loan/submit', isCustomer, async (req, res) => {
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
                applicant_id: req.user.applicant_id,
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

        res.render('loan_application/application_success', {
            application: {
                applicationID: data.application_number,
                loanType: '—',
                amount: parseFloat(data.loan_amount_requested).toLocaleString('en-IN'),
                applicationDate: new Date(data.submitted_at).toLocaleDateString('en-IN')
            }
        });

    } catch (err) {
        console.error('Submit error:', err.message);
        res.status(500).send('Could not submit application. Please try again.');
    }
});

app.get('/customer/apply-loan/success', (req, res) => {
    res.render('loan_application/application_success', {
        application: {
            applicationID: 'RU2026000215',
            loanType: '—',
            amount: '0',
            applicationDate: new Date().toLocaleDateString('en-IN')
        }
    });
});

app.get('/customer/application-success', (req, res) => {
    res.render('loan_application/application_success', {
        application: {
            applicationID: 100245,
            loanType: 'Personal Loan',
            amount: '5,00,000',
            applicationDate: '18 June 2026'
        }
    });
});

app.listen(3000, () => {
    console.log('Rupya AI server running on http://localhost:3000');
});