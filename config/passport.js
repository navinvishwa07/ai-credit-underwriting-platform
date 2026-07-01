const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const supabase = require('./supabase');

passport.use(
    'analyst-local',
    new LocalStrategy(
        { usernameField: 'email', passwordField: 'password' },
        async (email, password, done) => {
            try {
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('user_id, email, password_hash, role, is_active')
                    .eq('email', email.trim().toLowerCase())
                    .single();

                if (userError || !user) {
                    return done(null, false, { message: 'Invalid email or password.' });
                }

                if (!user.is_active) {
                    return done(null, false, { message: 'Your account has been deactivated. Contact admin.' });
                }

                if (!['analyst', 'admin'].includes(user.role)) {
                    return done(null, false, { message: 'Access denied. Analyst credentials required.' });
                }

                const isMatch = await bcrypt.compare(password, user.password_hash);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password.' });
                }

                const { data: analyst, error: analystError } = await supabase
                    .from('analysts')
                    .select('analyst_id, first_name, last_name, email, department, role, designation, employee_number')
                    .eq('user_id', user.user_id)
                    .single();

                if (analystError || !analyst) {
                    return done(null, false, { message: 'Analyst profile not found. Contact admin.' });
                }

                return done(null, {
                    user_id:        user.user_id,
                    analyst_id:     analyst.analyst_id,
                    email:          user.email,
                    role:           user.role,
                    firstName:      analyst.first_name,
                    lastName:       analyst.last_name,
                    department:     analyst.department,
                    designation:    analyst.designation,
                    employeeNumber: analyst.employee_number,
                });

            } catch (err) {
                return done(err);
            }
        }
    )
);

passport.use(
    'customer-local',
    new LocalStrategy(
        { usernameField: 'email', passwordField: 'password' },
        async (email, password, done) => {
            try {
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('user_id, email, password_hash, role, is_active')
                    .eq('email', email.trim().toLowerCase())
                    .single();

                if (userError || !user) {
                    return done(null, false, { message: 'Invalid email or password.' });
                }

                if (!user.is_active) {
                    return done(null, false, { message: 'Your account has been deactivated.' });
                }

                if (user.role !== 'customer') {
                    return done(null, false, { message: 'Invalid email or password.' });
                }

                const isMatch = await bcrypt.compare(password, user.password_hash);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password.' });
                }

                const { data: applicant, error: applicantError } = await supabase
                    .from('applicants')
                    .select('applicant_id, first_name, last_name, email')
                    .eq('email', email.trim().toLowerCase())
                    .single();

                if (applicantError || !applicant) {
                    return done(null, false, { message: 'Customer profile not found.' });
                }

                return done(null, {
                    user_id:      user.user_id,
                    applicant_id: applicant.applicant_id,
                    email:        user.email,
                    role:         user.role,
                    firstName:    applicant.first_name,
                    lastName:     applicant.last_name,
                });

            } catch (err) {
                return done(err);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, { user_id: user.user_id, role: user.role });
});

passport.deserializeUser(async ({ user_id, role }, done) => {
    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('user_id, email, role, is_active')
            .eq('user_id', user_id)
            .single();

        if (userError || !user || !user.is_active) {
            return done(null, false);
        }

        if (role === 'customer') {
            const { data: applicant, error } = await supabase
                .from('applicants')
                .select('applicant_id, first_name, last_name, email')
                .eq('email', user.email)
                .single();

            if (error || !applicant) return done(null, false);

            return done(null, {
                user_id:      user.user_id,
                applicant_id: applicant.applicant_id,
                email:        user.email,
                role:         user.role,
                firstName:    applicant.first_name,
                lastName:     applicant.last_name,
            });
        }

        if (['analyst', 'admin'].includes(role)) {
            const { data: analyst, error } = await supabase
                .from('analysts')
                .select('analyst_id, first_name, last_name, email, department, role, designation, employee_number')
                .eq('user_id', user_id)
                .single();

            if (error || !analyst) return done(null, false);

            return done(null, {
                user_id:        user.user_id,
                analyst_id:     analyst.analyst_id,
                email:          user.email,
                role:           user.role,
                firstName:      analyst.first_name,
                lastName:       analyst.last_name,
                department:     analyst.department,
                designation:    analyst.designation,
                employeeNumber: analyst.employee_number,
            });
        }

        return done(null, false);

    } catch (err) {
        done(err);
    }
});

module.exports = passport;
