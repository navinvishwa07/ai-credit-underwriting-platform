const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
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

app.get('/customer/signup', (req, res) => {
    res.render('customer/customer_signup', { errorMessage: null });
});

app.post('/customer/signup', async (req, res) => {
    const { first_name, last_name, email, phone, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
        return res.render('customer/customer_signup', {
            errorMessage: 'Please enter a valid email address.'
        });
    }

    try {
        const hash = await bcrypt.hash(password, 12);

        const { data: userRow, error: userError } = await supabase
            .from('users')
            .insert({
                email: normalizedEmail,
                password_hash: hash,
                role: 'customer'
            })
            .select('user_id')
            .single();

        if (userError) {
            console.error('Signup insert error:', userError);

            const isDuplicateEmail = /duplicate|already exists|unique/i.test(userError.message || '')
                || userError.code === '23505';

            return res.render('customer/customer_signup', {
                errorMessage: isDuplicateEmail
                    ? 'Email already registered. Please log in.'
                    : 'Something went wrong. Please try again.'
            });
        }

        await supabase.from('applicants').insert({
            first_name,
            last_name,
            email: normalizedEmail,
            phone,
            dob: '2000-01-01',
            address_line1: 'To be updated',
            city: 'To be updated',
            pincode: '000000',
            monthly_income: 0
        });

        res.redirect('/customer/login');

    } catch (err) {
        console.error('Signup error:', err.message || err);
        res.render('customer/customer_signup', {
            errorMessage: 'Something went wrong. Please try again.'
        });
    }
});

app.get('/analyst/dashboard', isAnalyst, async (req, res) => {
    try {
        const { data: myApplications, error: myError } = await supabase
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
            .eq('assigned_analyst_id', req.user.analyst_id)
            .order('submitted_at', { ascending: false });

        if (myError) throw myError;

        const stats = {
            total: myApplications?.length || 0,
            underReview: myApplications.filter(a => a.status === 'Under Review').length,
            approved: myApplications.filter(a => a.status === 'Approved').length,
            rejected: myApplications.filter(a => a.status === 'Rejected').length,
        };

        res.render('analyst/analyst_dashboard', {
            analyst: req.user,
            myApplications: myApplications || [],
            stats
        });

    } catch (err) {
        console.error('Analyst dashboard error:', err.message || err);
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
                assigned_analyst_id,
                applicant_id,
                loan_types ( loan_type_name ),
                repayment  ( repayment_mode )
            `)
            .eq('application_id', appId)
            .single();

        if (appError || !application) {
            return res.status(404).send('Application not found.');
        }

        if (application.assigned_analyst_id !== req.user.analyst_id) {
            return res.status(403).send('Access denied. This application is assigned to another analyst.');
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


        res.render('analyst/analyst_review', {
            analyst: req.user,
            application,
            applicant,
            creditEnquiry,
            riskAssessment
        });

    } catch (err) {
        console.error('Review error:', err.message || err);
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
        const { data: currentApplication, error: appError } = await supabase
            .from('applications')
            .select('assigned_analyst_id')
            .eq('application_id', appId)
            .single();

        if (appError || !currentApplication) {
            return res.status(404).send('Application not found.');
        }

        if (currentApplication.assigned_analyst_id !== req.user.analyst_id) {
            return res.status(403).send('Access denied. This application is assigned to another analyst.');
        }

        const { data: updated, error } = await supabase
            .from('applications')
            .update({
                status: decision,
                decision_notes: decision_notes.trim(),
                decided_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('application_id', appId)
            .select('application_number, status')
            .single();

        if (error) throw error;

        res.redirect(`/analyst/applications/${appId}/review`);

    } catch (err) {
        console.error('Decision error:', err.message || err);
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

app.get('/customer/profile/edit', isCustomer, async (req, res) => {
    try {
        const { data: row, error } = await supabase
            .from('applicants')
            .select('*')
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        if (error) throw error;
        if (!row) return res.status(404).send('Applicant not found.');

        const [{ data: genders }, { data: states }, { data: occupations }, { data: employmentTypes }] = await Promise.all([
            supabase.from('gender').select('*').order('gender_id'),
            supabase.from('states').select('*').order('state_name'),
            supabase.from('occupation').select('*').order('occupation_id'),
            supabase.from('employment_types').select('*').order('employment_type_id')
        ]);

        const successMessage = req.session.profileSuccess || null;
        const errorMessage = req.session.profileError || null;
        delete req.session.profileSuccess;
        delete req.session.profileError;

        res.render('customer/customer_edit_profile', {
            customer: row,
            genders: genders || [],
            states: states || [],
            occupations: occupations || [],
            employmentTypes: employmentTypes || [],
            successMessage,
            errorMessage
        });

    } catch (err) {
        console.error('Edit profile error:', err.message);
        res.status(500).send('Could not load edit profile. Please try again later.');
    }
});

app.post('/customer/profile/update', isCustomer, async (req, res) => {
    try {
        const {
            first_name, middle_name, last_name, dob,
            gender_id, phone, pan_number, aadhaar_number,
            address_line1, address_line2, city, state_id, pincode,
            occupation_id, employer_name, employment_type_id, monthly_income,
            bank_name, account_number, ifsc_code
        } = req.body;

        const updateData = {
            first_name: first_name?.trim(),
            middle_name: middle_name?.trim() || null,
            last_name: last_name?.trim(),
            dob,
            gender_id: gender_id ? parseInt(gender_id) : null,
            phone: phone?.trim(),
            pan_number: pan_number?.trim() || null,
            aadhaar_number: aadhaar_number?.trim() || null,
            address_line1: address_line1?.trim(),
            address_line2: address_line2?.trim() || null,
            city: city?.trim(),
            state_id: state_id ? parseInt(state_id) : null,
            pincode: pincode?.trim(),
            occupation_id: occupation_id ? parseInt(occupation_id) : null,
            employer_name: employer_name?.trim() || null,
            employment_type_id: employment_type_id ? parseInt(employment_type_id) : null,
            monthly_income: monthly_income ? parseFloat(monthly_income) : null,
            bank_name: bank_name?.trim() || null,
            account_number: account_number?.trim() || null,
            ifsc_code: ifsc_code?.trim() || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('applicants')
            .update(updateData)
            .eq('applicant_id', req.user.applicant_id);

        if (error) throw error;

        req.session.profileSuccess = 'Profile updated successfully.';
        res.redirect('/customer/profile/edit');

    } catch (err) {
        console.error('Profile update error:', err.message);
        req.session.profileError = 'Could not update profile. Please try again.';
        res.redirect('/customer/profile/edit');
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

app.get('/customer/apply-loan', isCustomer, async (req, res) => {
    req.session.loanApplication = {
        ...req.session.loanApplication,
        ...req.query
    };

    try {
        const { data: profile, error: profileError } = await supabase
            .from('applicants')
            .select('first_name, middle_name, last_name, dob, pan_number, aadhaar_number, email, phone, address_line1, address_line2, city, pincode, states ( state_name )')
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        if (profileError) throw profileError;

        const profileData = profile || {};
        if (profileData.states) {
            profileData.stateName = profileData.states.state_name;
        }

        res.render('customer/loan_application/step1_personalInfo', {
            loanApp: req.session.loanApplication || {},
            profile: profileData
        });
    } catch (err) {
        console.error('Loan step 1 error:', err.message || err);
        res.status(500).send('Could not load loan application. Please try again later.');
    }
});

app.get('/customer/apply-loan/step2', isCustomer, (req, res) => {
    req.session.loanApplication = {
        ...req.session.loanApplication,
        ...req.query
    };

    res.render('customer/loan_application/step2_loanDetails', {
        loanApp: req.session.loanApplication || {}
    });
});

app.get('/customer/apply-loan/step3', isCustomer, async (req, res) => {
    req.session.loanApplication = {
        ...req.session.loanApplication,
        ...req.query
    };

    try {
        const { data: profile } = await supabase
            .from('applicants')
            .select('employer_name, monthly_income, bank_name')
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        res.render('customer/loan_application/step3_employmentDetails', {
            loanApp: req.session.loanApplication || {},
            profile: profile || {}
        });
    } catch (err) {
        console.error('Loan step 3 error:', err.message || err);
        res.status(500).send('Could not load employment details. Please try again later.');
    }
});

app.get('/customer/apply-loan/step4', isCustomer, async (req, res) => {
    req.session.loanApplication = {
        ...req.session.loanApplication,
        ...req.query
    };

    try {
        const { data: profile } = await supabase
            .from('applicants')
            .select('bank_name, account_number, ifsc_code')
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        res.render('customer/loan_application/step4_financialInformation', {
            loanApp: req.session.loanApplication || {},
            profile: profile || {}
        });
    } catch (err) {
        console.error('Loan step 4 error:', err.message || err);
        res.status(500).send('Could not load financial information. Please try again later.');
    }
});

app.get('/customer/apply-loan/step5', isCustomer, (req, res) => {
    req.session.loanApplication = {
        ...req.session.loanApplication,
        ...req.query
    };

    res.render('customer/loan_application/step5_creditInformation', {
        loanApp: req.session.loanApplication || {}
    });
});

app.get('/customer/apply-loan/step6', isCustomer, async (req, res) => {
    req.session.loanApplication = {
        ...req.session.loanApplication,
        ...req.query
    };

    const loanApp = req.session.loanApplication || {};

    try {
        const { data: profile } = await supabase
            .from('applicants')
            .select('first_name, last_name, dob, pan_number, email, phone, address_line1, address_line2, city, pincode, employer_name, monthly_income, bank_name, states ( state_name )')
            .eq('applicant_id', req.user.applicant_id)
            .maybeSingle();

        const p = profile || {};
        const profileAddress = [p.address_line1, p.address_line2, p.city, p.states?.state_name, p.pincode].filter(Boolean).join(', ');

        const applicationReview = {
            personal: {
                name: [loanApp.firstName, loanApp.lastName].filter(Boolean).join(' ') || [p.first_name, p.last_name].filter(Boolean).join(' ') || '—',
                dob: loanApp.dob || p.dob || '—',
                pan: loanApp.pan || p.pan_number || '—',
                email: loanApp.email || p.email || '—',
                phone: loanApp.mobile || p.phone || '—',
                address: loanApp.address || profileAddress || '—'
            },
            loan: {
                amount: loanApp.loanAmount ? parseFloat(loanApp.loanAmount).toLocaleString('en-IN') : '—',
                type: loanApp.loanType || '—',
                purpose: loanApp.loanPurpose || '—',
                tenure: loanApp.loanTenure || '—'
            },
            employment: {
                employer: loanApp.companyName || p.employer_name || '—',
                monthlyIncome: loanApp.monthlyIncome ? parseFloat(loanApp.monthlyIncome).toLocaleString('en-IN') : (p.monthly_income ? parseFloat(p.monthly_income).toLocaleString('en-IN') : '—'),
                experience: loanApp.totalExperience || '—'
            },
            financial: {
                currentEmi: loanApp.currentMonthlyEmi ? parseFloat(loanApp.currentMonthlyEmi).toLocaleString('en-IN') : '—',
                outstandingLoans: loanApp.outstandingLoanAmount ? parseFloat(loanApp.outstandingLoanAmount).toLocaleString('en-IN') : '—',
                savings: loanApp.savingsBalance ? parseFloat(loanApp.savingsBalance).toLocaleString('en-IN') : '—',
                assets: loanApp.investments || '—'
            },
            credit: {
                cards: loanApp.creditCards || '—',
                defaults: loanApp.previousDefaults || '—',
                consent: 'Yes'
            }
        };

        res.render('customer/loan_application/step6_reviewSubmit', {
            applicationReview,
            loanApp
        });

    } catch (err) {
        console.error('Loan step 6 error:', err.message || err);
        res.status(500).send('Could not load review page. Please try again later.');
    }
});

app.post('/customer/apply-loan/submit', isCustomer, async (req, res) => {
    try {
        const loanApp = req.session.loanApplication || {};
        const loanTypeName = loanApp.loanType || req.body.loanType;
        const repaymentMethod = loanApp.repaymentMethod || req.body.repaymentMethod;
        const loanAmount = parseFloat(loanApp.loanAmount || req.body.loanAmount);
        const loanTenure = parseInt(loanApp.loanTenure || req.body.loanTenure, 10);
        const loanPurpose = loanApp.loanPurpose || req.body.loanPurpose || null;

        if (!loanTypeName || isNaN(loanAmount) || isNaN(loanTenure)) {
            return res.status(400).send('Incomplete loan application data. Please complete all required steps.');
        }

        const { data: loanTypeRow, error: loanTypeError } = await supabase
            .from('loan_types')
            .select('loan_type_id')
            .eq('loan_type_name', loanTypeName)
            .maybeSingle();

        if (loanTypeError) throw loanTypeError;
        if (!loanTypeRow) {
            return res.status(400).send('Invalid loan type selected.');
        }

        let repaymentId = null;
        if (repaymentMethod) {
            const { data: repaymentRow, error: repaymentError } = await supabase
                .from('repayment')
                .select('repayment_id')
                .eq('repayment_mode', repaymentMethod)
                .maybeSingle();

            if (repaymentError) throw repaymentError;
            repaymentId = repaymentRow?.repayment_id || null;
        }

        const appNumber = `RU${new Date().getFullYear()}${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

        const { data: analysts, error: analystError } = await supabase
            .from('analysts')
            .select('analyst_id, first_name, last_name')
            .eq('is_active', true);

        if (analystError) throw analystError;
        if (!analysts || analysts.length === 0) {
            return res.status(500).send('No available analysts to assign at the moment. Please try again later.');
        }

        const { data: workloads, error: workloadError } = await supabase
            .from('applications')
            .select('assigned_analyst_id')
            .in('status', ['Submitted', 'Under Review'])
            .in('assigned_analyst_id', analysts.map(a => a.analyst_id));

        if (workloadError) throw workloadError;

        const countMap = {};
        analysts.forEach(a => {
            countMap[a.analyst_id] = 0;
        });
        workloads?.forEach(row => {
            if (row.assigned_analyst_id && countMap.hasOwnProperty(row.assigned_analyst_id)) {
                countMap[row.assigned_analyst_id] += 1;
            }
        });

        const leastBusyAnalyst = analysts.reduce((min, analyst) => {
            if (countMap[analyst.analyst_id] < countMap[min.analyst_id]) {
                return analyst;
            }
            return min;
        }, analysts[0]);

        const { data, error } = await supabase
            .from('applications')
            .insert({
                application_number: appNumber,
                applicant_id: req.user.applicant_id,
                loan_type_id: loanTypeRow.loan_type_id,
                loan_amount_requested: loanAmount,
                loan_tenure_months: loanTenure,
                loan_purpose: loanPurpose,
                repayment_id: repaymentId,
                status: 'Submitted',
                assigned_analyst_id: leastBusyAnalyst.analyst_id
            })
            .select()
            .single();

        if (error) throw error;

        req.session.loanApplication = null;

        res.render('customer/loan_application/application_success', {
            application: {
                applicationID: data.application_number,
                loanType: loanTypeName,
                amount: parseFloat(data.loan_amount_requested).toLocaleString('en-IN'),
                applicationDate: new Date(data.submitted_at).toLocaleDateString('en-IN'),
                assignedAnalyst: `${leastBusyAnalyst.first_name} ${leastBusyAnalyst.last_name}`
            }
        });

    } catch (err) {
        console.error('Submit error:', err.message || err);
        res.status(500).send('Could not submit application. Please try again.');
    }
});



app.listen(3000, () => {
    console.log('Rupya AI server running on http://localhost:3000');
});