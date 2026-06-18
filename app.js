const express = require('express');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.get('/customer/dashboard', (req, res) => {

    const customer = {
        name: 'Navin'
    };

    const loanSummary = {
        totalApplications: 5,
        underReview: 2,
        approvedApplications: 2,
        rejectedApplications: 1
    };

    const recentApplications = [
        {
            applicationID: 101,
            loanType: 'Personal Loan',
            applicationDate: '2025-06-01',
            amount: 500000,
            status: 'Under Review'
        }
    ];

    res.render('customer/customer_dashboard', {
        customer,
        loanSummary,
        recentApplications
    });

});

app.get('/customer/profile', (req, res) => {

    const customer = {
        name: 'Navin Vishwa',
        email: 'navin.vishwa@example.com',
        phone: '9876543210',
        address: '123 Green Avenue, Sector 45',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        dob: new Date('1990-07-15'),
        gender: 'Male',
        pan: 'ABCDE1234F',
        aadhaar: '123412341234',
        occupation: 'Software Engineer',
        employer: 'Rupya AI Technologies',
        annualIncome: '12,00,000',
        preferredLoanType: 'Home Loan',
        lastApplicationStatus: 'Approved',
        riskCategory: 'Low',
        accountCreated: new Date('2024-01-12')
    };

    res.render('customer/customer_profile', {
        customer
    });

});


// ===============================
// Application Tracker
// ===============================

app.get('/customer/loan-status', (req, res) => {

    const applications = [
        {
            applicationID: 101,
            loanType: 'Personal Loan',
            applicationDate: '2025-06-01',
            amount: 500000,
            status: 'Under Review'
        },
        {
            applicationID: 102,
            loanType: 'Education Loan',
            applicationDate: '2025-05-15',
            amount: 300000,
            status: 'Approved'
        }
    ];

    res.render('customer/application_tracker', {
        applications
    });

});


app.get('/customer/apply-loan', (req, res) => {

    res.render('customer/loan_application/step1_personal_information');

});

app.get('/customer/apply-loan/step2', (req, res) => {

    res.render('customer/loan_application/step2_loan_details');

});


app.get('/customer/apply-loan/step3', (req, res) => {

    res.render('customer/loan_application/step3_employment_information');
});

app.get('/customer/apply-loan/step4', (req, res) => {

    res.render('customer/loan_application/step4_financial_information');
});

app.get('/customer/apply-loan/step5', (req, res) => {

    res.render('customer/loan_application/step5_credit_information');
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

    res.render('customer/loan_application/step6_review_submit', {
        applicationReview
    });
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

    res.render('customer/loan_application/application_success', {
        applicationResult
    });
});

app.listen(3000, () => {

    console.log('Server running on port 3000');

});