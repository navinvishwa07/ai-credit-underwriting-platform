const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const supabase = require('./supabase');

passport.use(
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
                    .select('analyst_id, first_name, last_name, email, department, role, designation, employee_number, is_active')
                    .eq('user_id', user.user_id)
                    .single();

                if (analystError || !analyst) {
                    return done(null, false, { message: 'Analyst profile not found. Contact admin.' });
                }

                const sessionUser = {
                    user_id:        user.user_id,
                    analyst_id:     analyst.analyst_id,
                    email:          user.email,
                    role:           user.role,
                    firstName:      analyst.first_name,
                    lastName:       analyst.last_name,
                    department:     analyst.department,
                    designation:    analyst.designation,
                    employeeNumber: analyst.employee_number,
                };

                return done(null, sessionUser);

            } catch (err) {
                return done(err);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async (user_id, done) => {
    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('user_id, email, role, is_active')
            .eq('user_id', user_id)
            .single();

        if (userError || !user || !user.is_active) {
            return done(null, false);
        }

        const { data: analyst, error: analystError } = await supabase
            .from('analysts')
            .select('analyst_id, first_name, last_name, email, department, role, designation, employee_number')
            .eq('user_id', user_id)
            .single();

        if (analystError || !analyst) {
            return done(null, false);
        }

        done(null, {
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
        done(err);
    }
});

module.exports = passport;
