const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const path = require('path');
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

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

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

app.get('/analyst/signup', (req, res) => {
    res.render('analyst/analyst_signup', { errorMessage: null });
});

app.post('/analyst/signup', async (req, res) => {
    const { first_name, last_name, email, phone, department, designation, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!first_name?.trim() || !last_name?.trim() || !normalizedEmail || !password) {
        return res.render('analyst/analyst_signup', {
            errorMessage: 'Please complete all required fields.'
        });
    }

    try {
        const hash = await bcrypt.hash(password, 12);

        const { data: userRow, error: userError } = await supabase
            .from('users')
            .insert({
                email: normalizedEmail,
                password_hash: hash,
                role: 'analyst'
            })
            .select('user_id')
            .single();

        if (userError) {
            console.error('Analyst signup insert error:', userError);

            const isDuplicateEmail = /duplicate|already exists|unique/i.test(userError.message || '')
                || userError.code === '23505';

            return res.render('analyst/analyst_signup', {
                errorMessage: isDuplicateEmail
                    ? 'Email already registered. Please log in.'
                    : 'Something went wrong. Please try again.'
            });
        }

        const employeeNumber = `EMP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

        const { error: analystError } = await supabase
            .from('analysts')
            .insert({
                user_id: userRow.user_id,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                email: normalizedEmail,
                phone: phone?.trim() || null,
                department: department?.trim() || null,
                designation: designation?.trim() || null,
                employee_number: employeeNumber,
                role: 'Analyst',
                is_active: true
            });

        if (analystError) {
            console.error('Analyst profile insert error:', analystError);
            await supabase.from('users').delete().eq('user_id', userRow.user_id);
            return res.render('analyst/analyst_signup', {
                errorMessage: 'Could not create analyst profile. Please try again.'
            });
        }

        res.redirect('/analyst/login');

    } catch (err) {
        console.error('Analyst signup error:', err.message || err);
        res.render('analyst/analyst_signup', {
            errorMessage: 'Something went wrong. Please try again.'
        });
    }
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

        let riskFactors = [];
        if (riskAssessment) {
            const { data: factorRows } = await supabase
                .from('risk_factors')
                .select('*')
                .eq('assessment_id', riskAssessment.assessment_id)
                .order('factor_score', { ascending: false });
            riskFactors = factorRows || [];
        }

        res.render('analyst/analyst_review', {
            analyst: req.user,
            application,
            applicant,
            creditEnquiry,
            riskAssessment,
            riskFactors
        });

    } catch (err) {
        console.error('Review error:', err.message || err);
        res.status(500).send('Could not load application review.');
    }
});

app.post('/analyst/applications/:id/run-ai', isAnalyst, async (req, res) => {
    const appId = parseInt(req.params.id, 10);

    try {
        // Fetch application data
        const { data: application, error: appError } = await supabase
            .from('applications')
            .select(`
                application_id, loan_amount_requested, loan_tenure_months, loan_purpose,
                assigned_analyst_id,
                loan_types ( loan_type_name )
            `)
            .eq('application_id', appId)
            .single();

        if (appError || !application) return res.status(404).send('Application not found.');
        if (application.assigned_analyst_id !== req.user.analyst_id) {
            return res.status(403).send('Access denied.');
        }

        // Fetch applicant data with lookup names
        const { data: applicant, error: applicantError } = await supabase
            .from('applicants')
            .select(`
                applicant_id, monthly_income,
                gender ( gender_name ),
                marital_status ( marital_status_name ),
                education_level ( education_level_name ),
                employment_types ( employment_type_name ),
                occupation ( occupation_name ),
                income_types ( income_type_name ),
                states ( state_name ),
                account_types ( account_type_name )
            `)
            .eq('applicant_id', (await supabase.from('applications').select('applicant_id').eq('application_id', appId).single()).data.applicant_id)
            .single();

        if (applicantError) throw applicantError;

        // Fetch credit enquiry if available
        const { data: creditRows } = await supabase
            .from('credit_enquiries')
            .select('credit_score, total_outstanding')
            .eq('application_id', appId)
            .order('created_at', { ascending: false })
            .limit(1);
        const credit = creditRows?.[0] || {};

        // Build the feature payload for the model
        const monthlyIncome = parseFloat(applicant.monthly_income) || 0;
        const loanAmount = parseFloat(application.loan_amount_requested) || 0;
        const existingEmi = 0; // Default — not stored in applicants table
        const savingsBalance = 0;
        const totalAssets = 0;
        const liquidAssets = 0;
        const creditScore = credit.credit_score || 650;

        const modelInput = {
            age: 30, // Not stored in applicants table directly as age; default
            gender: applicant.gender?.gender_name || 'Male',
            marital_status: applicant.marital_status?.marital_status_name || 'Single',
            number_of_dependents: 0,
            education_level: applicant.education_level?.education_level_name || 'Undergraduate',
            employment_type: applicant.employment_types?.employment_type_name || 'Full-Time',
            occupation: applicant.occupation?.occupation_name || 'Salaried Employee',
            income_type: applicant.income_types?.income_type_name || 'Salary',
            state: applicant.states?.state_name || 'Maharashtra',
            area_type: 'Urban',
            monthly_income: monthlyIncome,
            loan_type: application.loan_types?.loan_type_name || 'Personal Loan',
            loan_amount_requested: loanAmount,
            loan_tenure_months: application.loan_tenure_months || 12,
            loan_purpose: application.loan_purpose || 'Other',
            credit_score: creditScore,
            existing_emi: existingEmi,
            savings_balance: savingsBalance,
            total_assets_value: totalAssets,
            liquid_assets_value: liquidAssets,
            loan_to_income_ratio: monthlyIncome > 0 ? parseFloat((loanAmount / monthlyIncome).toFixed(4)) : 0,
            debt_to_income_ratio: monthlyIncome > 0 ? parseFloat((existingEmi / monthlyIncome).toFixed(4)) : 0
        };

        // Call Python predict.py via child_process
        const pythonScript = path.join(__dirname, 'ai', 'src', 'predict.py');
        const fs = require('fs');
        const condaPython = '/opt/anaconda3/bin/python3';
        const pythonCmd = fs.existsSync(condaPython) ? condaPython : 'python3';
        
        const result = await new Promise((resolve, reject) => {
            const proc = spawn(pythonCmd, [pythonScript], {
                cwd: path.join(__dirname, 'ai', 'src')
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                if (code !== 0) {
                    console.error('Python stderr:', stderr);
                    return reject(new Error(`Python process exited with code ${code}`));
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error('Failed to parse AI model output'));
                }
            });

            proc.stdin.write(JSON.stringify(modelInput));
            proc.stdin.end();
        });

        if (result.error) {
            throw new Error(result.message || 'AI model returned an error');
        }

        // Delete existing assessment for this application (if re-running)
        const { data: existingAssessment } = await supabase
            .from('risk_assessments')
            .select('assessment_id')
            .eq('application_id', appId)
            .maybeSingle();

        if (existingAssessment) {
            await supabase.from('risk_factors').delete().eq('assessment_id', existingAssessment.assessment_id);
            await supabase.from('risk_assessments').delete().eq('assessment_id', existingAssessment.assessment_id);
        }

        // Insert risk assessment
        const { data: assessment, error: assessError } = await supabase
            .from('risk_assessments')
            .insert({
                application_id: appId,
                overall_score: result.overall_score,
                risk_category: result.risk_category,
                recommendation: result.recommendation,
                debt_to_income_ratio: Math.min(modelInput.debt_to_income_ratio, 9.9999),
                loan_to_income_ratio: Math.min(modelInput.loan_to_income_ratio, 9.9999),
                credit_score_used: modelInput.credit_score,
                assessed_by: 'AI',
                status: 'Completed',
                assessed_at: new Date().toISOString()
            })
            .select('assessment_id')
            .single();

        if (assessError) throw assessError;

        // Insert top risk factors
        const factors = (result.top_factors || []).slice(0, 10).map(f => ({
            assessment_id: assessment.assessment_id,
            factor_name: f.feature,
            factor_value: String(f.value),
            factor_score: Math.min(Math.abs(f.shap_value), 999.99),
            impact: f.impact,
            weight: Math.min(Math.abs(f.shap_value), 9.9999),
            description: `${f.feature} = ${f.value} (SHAP: ${f.shap_value > 0 ? '+' : ''}${f.shap_value.toFixed(4)})`
        }));

        if (factors.length > 0) {
            const { error: factorError } = await supabase
                .from('risk_factors')
                .insert(factors);
            if (factorError) throw factorError;
        }

        res.redirect(`/analyst/applications/${appId}/review`);

    } catch (err) {
        console.error('AI assessment error:', err.message || err);
        res.status(500).send('Could not run AI assessment. Please try again.');
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
                loan_types ( loan_type_name ),
                analysts ( first_name, last_name )
            `)
            .eq('applicant_id', req.user.applicant_id)
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        const applications = rows.map(a => ({
            applicationID: a.application_number,
            loanType: a.loan_types?.loan_type_name || '—',
            applicationDate: new Date(a.submitted_at).toLocaleDateString('en-IN'),
            amount: a.loan_amount_requested,
            status: a.status,
            assignedAnalyst: a.analysts
                ? `${a.analysts.first_name} ${a.analysts.last_name}`
                : 'Not assigned yet'
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