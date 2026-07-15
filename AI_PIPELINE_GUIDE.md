# Loan Underwriting AI Pipeline - Complete Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Theory & Concepts](#theory--concepts)
4. [Data Flow](#data-flow)
5. [File-by-File Explanation](#file-by-file-explanation)
6. [Interview Preparation](#interview-preparation)

---

## System Overview

This is a **machine learning classification system** that predicts whether a loan application should be **approved or rejected** based on applicant characteristics.

### High-Level Goal
```
Customer submits loan application
            ↓
System extracts features (age, income, credit score, etc.)
            ↓
XGBoost model predicts: APPROVED or REJECTED
            ↓
Analyst reviews AI recommendation + provides final decision
```

---

## Architecture

### The ML Pipeline (4 Stages)

```
STAGE 1: PREPROCESS
─────────────────────
Raw Data (CSV)
    ↓
Load Dataset
    ↓
Select Features (22 features chosen)
    ↓
Handle Missing Values (median/mode)
    ↓
Encode Categories (text → numbers)
    ↓
Split Dataset (70% train, 15% val, 15% test)
    ↓
Clean Data Ready


STAGE 2: TRAIN
──────────────
Clean Data
    ↓
Create XGBoost Model
    ↓
Train on 70% data
    ↓
Validate on 15% data
    ↓
Trained Model (saved as .pkl file)


STAGE 3: EVALUATE
─────────────────
Trained Model
    ↓
Test on unseen 15% data
    ↓
Calculate: Accuracy, ROC-AUC, Precision, Recall, Confusion Matrix
    ↓
Report: Is the model good enough?


STAGE 4: PREDICT
────────────────
New Loan Application
    ↓
Load trained model + encoders
    ↓
Apply same transformations
    ↓
Model predicts probability
    ↓
Return: APPROVED (>0.5) or REJECTED (<0.5)
```

---

## Theory & Concepts

### 1. Classification Problem

**What is it?**
- We're solving a **binary classification** problem
- Output: YES (loan approved) or NO (loan rejected)
- Not regression (predicting continuous values like 5.2)
- Not clustering (grouping without labels)

**Why XGBoost?**
```
Problem: Loan approval depends on complex interactions
Example:
  - High income alone = not always approval
  - High income + good credit score + low debt = likely approval
  - High income + bad credit + high debt = reject

XGBoost handles these interactions well because:
  - It's an ensemble method (combines multiple weak learners)
  - Each tree corrects errors from the previous one
  - Naturally captures feature interactions
  - Fast training and inference
  - Handles imbalanced data better than simpler models
```

### 2. Data Preprocessing (The Foundation)

**Why is preprocessing so critical?**
```
Raw data has problems:
  ✗ Missing values (nulls) - model can't compute
  ✗ Text values (categorical) - model only understands numbers
  ✗ Different scales (age: 20-70, income: 50k-500k) - can confuse model
  ✗ Irrelevant features - add noise and slow training

Result: Garbage in → Garbage out
Clean data: Good in → Good out
```

**Key Preprocessing Steps:**

#### Step 1: Feature Selection
```
Why: Only 22 features out of possibly 100s
    - Some features are useless (name, ID)
    - Some features are redundant
    - Too many features = overfitting risk
    
How: Whitelist approach
    - Manually select features known to affect loan decisions
    - Income, credit score, employment, debt ratio, etc.
```

#### Step 2: Handle Missing Values
```
Strategy for Numerical Columns (age, income, credit_score):
  MEDIAN fill
  Why median? Because it's robust to outliers
  Example: [20, 25, 30, 35, 100] → median = 30 (not affected by 100)

Strategy for Categorical Columns (gender, employment_type):
  MODE fill (most common value)
  Why? Preserves data distribution
  Example: [M, M, F, M, ?] → fill ? with M (most common)
```

#### Step 3: Encode Categorical Features
```
Problem: Model only understands numbers
    Male/Female → 0/1
    Salaried/Business/Government → 0/1/2
    
Method: Label Encoding
    Each unique category gets an integer
    
Important: Must save encoders!
    When new customer applies → use SAME encoders
    This ensures consistency
    
Example:
    Training: Male→0, Female→1
    Prediction: If customer is Female, must still use 1 (not assign random)
```

#### Step 4: Train-Validation-Test Split
```
Why split data?
    Training set (70%): Model learns patterns
    Validation set (15%): Monitor performance during training
    Test set (15%): Final unbiased evaluation
    
Why 70-15-15?
    More training data = better learning
    Need separate validation to detect overfitting
    Test set must be completely unseen
    
What is overfitting?
    Model memorizes training data instead of learning patterns
    High training accuracy, low test accuracy = overfit
    
How to detect: If validation accuracy much lower than training
```

---

## Data Flow

### End-to-End Example

**Customer Submits Loan Application:**
```
Input Data:
  age: 35
  gender: "Male"
  monthly_income: 75000
  credit_score: 720
  existing_emi: 5000
  loan_amount_requested: 500000
  ... (other 16 features)
```

**During Training (Preprocessing):**
```
1. LOAD: Read master_dataset.csv (all historical applications)

2. SELECT FEATURES: Keep only 22 relevant columns
   Remove: customer_id, name, phone, etc.

3. HANDLE MISSING: If any null values exist
   Numerical: Replace with median
   Categorical: Replace with mode

4. ENCODE: Convert text to numbers
   gender: "Male" → 1, "Female" → 0
   employment_type: "Salaried" → 2, "Business" → 0, etc.
   
   SAVE encoders → label_encoders.pkl
   (Used later for new predictions)

5. SPLIT: Divide into 3 sets
   Train: 70% (train model)
   Val: 15% (monitor learning)
   Test: 15% (evaluate final performance)

Result: 3 ready-to-use datasets + encoders saved
```

**During Training (Model Learning):**
```
1. CREATE MODEL: XGBoost with 100 decision trees

2. TRAIN: Feed training data to model
   Model learns: "If credit_score > 700 AND income > 50k → likely APPROVED"
   
3. VALIDATE: Check on validation set
   If validation accuracy > 85% → good
   If training accuracy >> validation accuracy → overfitting

4. SAVE MODEL: xgboost_model.pkl
   Later: just load this file to make predictions
```

**When New Customer Applies (Prediction):**
```
1. LOAD MODEL: xgboost_model.pkl
2. LOAD ENCODERS: label_encoders.pkl

3. PREPROCESS customer's input using SAME encoders
   age: 35 → 35 (no encoding needed)
   gender: "Male" → 1 (use saved encoder, not new one!)
   credit_score: 720 → 720

4. MODEL PREDICTS:
   Input: [35, 1, 75000, 720, 5000, ...]
   Output: Probability = 0.87 (87% confident)
   
5. DECISION:
   If probability > 0.5 → APPROVED
   If probability < 0.5 → REJECTED

6. RETURN TO UI:
   "Your application has been approved"
   Analyst can see: Model confidence = 87%
```

---

## File-by-File Explanation

### 1. `config.py` - Configuration Hub

**Purpose:** Centralized configuration file

**What it does:**
```
- Defines all paths (where to find data, where to save models)
- Sets hyperparameters (TEST_SIZE, VALIDATION_SIZE, RANDOM_STATE)
- Single source of truth
```

**Key Variables:**
```
BASE_DIR: Root of AI project
DATASET_DIR: Where CSV files live
MODEL_DIR: Where trained models are saved

RAW_DATASET: The original master_dataset.csv
TARGET_COLUMN: "loan_status" (what we're predicting)

TEST_SIZE: 0.15 (15% for testing)
VALIDATION_SIZE: 0.15 (15% for validation)
RANDOM_STATE: 42 (for reproducibility)
```

**Why separate config file?**
```
✓ Easy to change parameters without touching code
✓ All paths in one place → no hardcoding
✓ Easy to switch between dev/production configs
✓ Reproducibility: same random_state = same results every time
```

---

### 2. `feature_whitelist.py` - Feature Definitions

**Purpose:** Define which features to use

**What it does:**
```
Lists 22 features divided into 2 categories
```

**Feature Categories:**

**Categorical (text-based) - 10 features:**
- gender, marital_status, education_level, employment_type
- occupation, income_type, state, area_type
- loan_type, loan_purpose

**Numerical (numeric) - 12 features:**
- age, number_of_dependents, monthly_income
- loan_amount_requested, loan_tenure_months, credit_score
- existing_emi, savings_balance, total_assets_value
- liquid_assets_value, loan_to_income_ratio, debt_to_income_ratio

**Why this matters:**
```
Preprocessing treats them differently:
  - Categorical: Label encode (text → numbers)
  - Numerical: Handle missing values with median

Model learns from all 22 features to predict loan_status
```

**How features were selected (business logic):**
```
Credit Risk Factors:
  ✓ credit_score (direct risk indicator)
  ✓ existing_emi, debt_to_income_ratio (payment capacity)
  
Income & Stability:
  ✓ monthly_income, income_type, employment_type
  
Loan Details:
  ✓ loan_amount_requested, loan_tenure_months, loan_type, loan_purpose
  
Demographics & Location:
  ✓ age, gender, marital_status, education_level, state, area_type
  
Assets & Savings:
  ✓ savings_balance, total_assets_value, liquid_assets_value
```

---

### 3. `preprocess.py` - Data Cleaning Pipeline

**Purpose:** Transform raw data into clean, ready-to-train data

**Structure:**
```
load_dataset() → Load CSV
    ↓
select_features() → Keep only 22 features
    ↓
handle_missing_values() → Fill nulls
    ↓
encode_categorical_features() → Text to numbers
    ↓
split_dataset() → Create 3 datasets
    ↓
save_encoders() → Save encoders for later predictions
    ↓
preprocess() → Main orchestrator function
```

**Function Details:**

#### `load_dataset()`
```
Input: None
Process: Reads master_dataset.csv
Output: DataFrame with all columns
```

#### `select_features(df)`
```
Input: Full DataFrame
Process: Keep only FEATURE_COLUMNS + TARGET_COLUMN
Output: DataFrame with only 22 features + loan_status
Benefit: Removes noise, focuses on relevant features
```

#### `handle_missing_values(df)`
```
Input: DataFrame (possibly with nulls)
Process:
  For each numerical column: fill null with median
  For each categorical column: fill null with mode
Output: DataFrame with no nulls
```

#### `encode_categorical_features(df)`
```
Input: DataFrame with text categories
Process:
  For each categorical column:
    Create LabelEncoder
    Fit on data (learn mapping)
    Transform column (apply mapping)
    Store encoder in dictionary
Output: 
  1. DataFrame with numbers instead of text
  2. Dictionary of encoders (for later predictions)
```

#### `split_dataset(df)`
```
Input: Clean, encoded DataFrame
Process:
  1. Separate features (X) from target (y)
  2. Split into train/val/test (70/15/15)
Output: 6 arrays
  X_train, X_val, X_test, y_train, y_val, y_test
```

#### `save_encoders(encoders)`
```
Input: Dictionary of LabelEncoders
Process: Serialize (pickle) to disk
Output: models/label_encoders.pkl
Why: So future predictions use same mappings
```

#### `preprocess()` (Main Function)
```
Input: None (reads from config paths)
Process: Call all above functions in order
Output: 6 clean arrays ready for training
This is what train.py calls!
```

**Example Output:**
```
X_train shape: (7000, 22) → 7000 samples, 22 features
X_val shape: (1500, 22)
X_test shape: (1500, 22)
y_train: [0, 1, 0, 1, ...] → loan_status for each sample
```

---

### 4. `train.py` - Model Training

**Purpose:** Train the XGBoost model on clean data

**Structure:**
```
load_processed_data() → Call preprocess()
    ↓
create_model() → Create empty XGBoost
    ↓
train_model() → Fit on training data
    ↓
save_model() → Save trained model to disk
    ↓
train() → Main orchestrator
```

**Function Details:**

#### `load_processed_data()`
```
Input: None
Process: Calls preprocess() which does everything
Output: 6 arrays (X_train, X_val, X_test, y_train, y_val, y_test)
Benefit: One-liner gets all clean data
```

#### `create_model()`
```
Input: None
Process: Create XGBClassifier with parameters:
  n_estimators=100 → 100 decision trees
  learning_rate=0.1 → How fast to learn (slower = better but longer)
  random_state=42 → Reproducibility
Output: Empty model (not trained yet)
```

#### `train_model(model, X_train, y_train)`
```
Input: 
  model: Empty XGBoost classifier
  X_train: Training features
  y_train: Training labels (0/1)
  
Process: model.fit() 
  This is where learning happens!
  Model learns patterns from training data
  
Output: Trained model
```

#### `save_model(model)`
```
Input: Trained model
Process: Pickle to xgboost_model.pkl
Output: File on disk
Why: Load later for predictions without retraining
```

#### `train()` (Main Function)
```
Input: None
Process:
  1. Load clean data from preprocess()
  2. Create empty model
  3. Train on training data
  4. Validate on validation data (print accuracy)
  5. Save model to disk
  
Output: 
  - Trained model file
  - Validation accuracy printed
```

**What happens internally:**

```
XGBoost Training Loop (simplified):
─────────────────────────────────────

Start: Random model

Iteration 1:
  Make predictions on training data
  Calculate errors
  Create new tree to fix errors
  Update model

Iteration 2-100:
  Repeat: predict → calculate errors → add tree

Each tree: "I can fix the previous trees' errors"
Result: Ensemble of 100 trees, each specializing in errors the others miss
```

---

### 5. `evaluate.py` - Model Evaluation (Empty, but here's what it should do)

**Purpose:** Measure how good the trained model is

**What should be implemented:**
```
Load trained model
Test on unseen test data (15%)
Calculate metrics:
  - Accuracy: Percentage of correct predictions
  - Precision: Of approved loans, how many were actually good?
  - Recall: Of actual good loans, how many did we approve?
  - F1 Score: Balance between precision & recall
  - ROC-AUC: How well does model distinguish between classes?
  - Confusion Matrix: Breakdown of correct/incorrect predictions
```

**Interview talking points:**
```
Why test set? 
  - Training accuracy is biased (model saw this data)
  - Test set is unseen → true performance
  
Why multiple metrics?
  - Accuracy alone misleading (if 90% loans approved, model could say "approve all")
  - Precision: Are approved loans actually good?
  - Recall: Are we missing good loan candidates?
  - F1: Balance when trade-offs exist
```

---

### 6. `explain.py` - Model Explainability (Empty, but here's what it should do)

**Purpose:** Understand WHY the model makes decisions

**What should be implemented:**

**Feature Importance:**
```python
importance = model.feature_importances_
# Shows which features matter most
# Example output:
#   credit_score: 25%
#   debt_to_income_ratio: 20%
#   income: 18%
#   ...
```

**SHAP Explanations:**
```
For each prediction, show:
  Which features pushed decision toward APPROVED?
  Which features pushed decision toward REJECTED?
  By how much?
  
Example: "John's credit score (+0.15) and income (+0.10) favor approval,
but high debt ratio (-0.08) and young age (-0.05) favor rejection"
```

**Interview talking points:**
```
Why explainability matters?
  1. Regulatory: Loan decisions must be explainable (Fair Lending Laws)
  2. Trust: Analysts trust models more if they understand them
  3. Debugging: Understand if model learned right patterns
  4. Fairness: Check if model discriminates unfairly
```

---

### 7. `utils.py` - Helper Functions (Empty, could include)

**Potential utilities:**
```python
def load_model(path):
    "Load trained model from disk"
    
def load_encoders(path):
    "Load encoders for new predictions"
    
def preprocess_new_application(application_dict, encoders):
    "Apply same preprocessing to new customer"
    
def predict_approval(application_dict):
    "End-to-end: preprocess + predict"
    
def format_prediction_result(prediction, confidence):
    "Format output for API response"
```

---

## Interview Preparation

### How to Explain the System (2 Minute Version)

```
"This is a binary classification machine learning system built to predict 
loan approval. Here's the flow:

1. DATA PREPARATION (preprocess.py):
   We load historical loan data, select 22 relevant features, clean missing 
   values (using median for numbers, mode for categories), encode categorical 
   features as numbers, and split into train/val/test sets (70/15/15).

2. MODEL TRAINING (train.py):
   We train an XGBoost model on the training data. XGBoost works by creating 
   100 decision trees where each tree corrects errors from the previous ones.

3. MODEL EVALUATION (evaluate.py):
   We test on completely unseen data to measure performance using metrics like 
   accuracy, precision, recall, and ROC-AUC.

4. DEPLOYMENT (predict.py):
   When a new customer applies, we apply the same preprocessing using saved 
   encoders, feed through the trained model, get probability, and return 
   APPROVED if probability > 0.5, else REJECTED.

The key insight: By saving encoders and the trained model, we ensure 
consistency between training and prediction time."
```

### Common Interview Questions

**Q1: Why XGBoost over other models?**
```
Answer:
- Handles feature interactions well (income + credit score together matter more)
- Fast training and inference
- Robust to outliers
- Naturally handles missing values
- Great for tabular data (structured features)
- Industry standard for financial predictions
```

**Q2: What's overfitting and how do you detect it?**
```
Answer:
- Overfitting = model memorizes training data instead of learning patterns
- Detection: Training accuracy >> validation accuracy
  Example: Train=95%, Val=75% → overfitting
- Solutions: Use more data, reduce model complexity, add regularization
```

**Q3: Why split data into 3 sets (train/val/test)?**
```
Answer:
- Training: Model learns patterns
- Validation: Monitor learning, tune hyperparameters, detect overfitting
- Test: Final unbiased evaluation (completely unseen)
- If we only used train/test, validation accuracy would be biased
```

**Q4: Why save encoders separately?**
```
Answer:
- During training: gender "Male" → 1, "Female" → 0
- During prediction: must use SAME mappings
- If we created new encoder for new customer, might assign "Male" → 0
- This inconsistency would break the model
- Solution: Pickle encoders, load same ones for predictions
```

**Q5: What problems could arise in production?**
```
Answer:
1. Data drift: If new applicants differ from training data
   (e.g., suddenly more young applicants)
   Solution: Retrain periodically
   
2. Class imbalance: If 90% approved, 10% rejected
   Model might always predict approved
   Solution: Use SMOTE, class weights, ROC-AUC instead of accuracy
   
3. Feature staleness: If new features available, model can't use them
   Solution: Retrain with new features
   
4. Regulatory: Predictions must be explainable (Fair Lending Laws)
   Solution: Use SHAP explanations
```

**Q6: How would you improve this model?**
```
Answer:
1. Feature engineering: Create new features (income/loan ratio, age groups)
2. Handle imbalance: Use SMOTE if classes are imbalanced
3. Hyperparameter tuning: Grid search for best parameters
4. Ensemble: Combine XGBoost with other models
5. Validation: Time-based split (older loans for train, newer for test)
6. Monitoring: Track model performance over time, retrain when accuracy drops
```

**Q7: Walk through the prediction process for a new application.**
```
Answer:
1. Customer submits application: [age=35, gender="Male", income=75000, ...]
2. Load trained model and encoders from disk
3. Preprocess:
   - Numerical: Already numbers, use as-is
   - Categorical: gender "Male" → use saved encoder → 1
4. Create feature vector: [35, 1, 75000, ...]
5. Model predicts probability: 0.87
6. Decision: 0.87 > 0.5 → APPROVED
7. Return: "Application approved with 87% confidence"
8. Analyst reviews and makes final decision
```

---

## Key ML Concepts Summary

| Concept | Explanation | Example |
|---------|-------------|---------|
| **Classification** | Predicting category (not number) | Approved/Rejected |
| **Features** | Input variables | Age, income, credit score |
| **Target** | What we predict | loan_status |
| **Training** | Learning patterns from data | Fit model on historical loans |
| **Overfitting** | Model memorizes instead of learns | 99% train accuracy, 60% test accuracy |
| **Encoding** | Convert text to numbers | "Male"→1, "Female"→0 |
| **Imputation** | Fill missing values | Replace null with median |
| **Validation** | Monitor learning quality | Separate dataset to catch overfitting |
| **Ensemble** | Combine multiple models | XGBoost = 100 trees voting |
| **Accuracy** | Percentage correct | 85/100 correct = 85% |

---

## Flow Chart: Complete System

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAINING PHASE                           │
│                                                             │
│  master_dataset.csv                                        │
│         ↓                                                   │
│  preprocess.py:                                            │
│    - Load data                                             │
│    - Select 22 features                                    │
│    - Handle missing values (median/mode)                  │
│    - Encode categories (text→numbers)                     │
│    - Save encoders.pkl                                    │
│    - Split: 70% train, 15% val, 15% test                │
│         ↓                                                   │
│  train.py:                                                 │
│    - Create XGBoost (100 trees)                           │
│    - Train on 70% data                                    │
│    - Validate on 15% data                                 │
│    - Save model.pkl                                       │
│         ↓                                                   │
│  evaluate.py:                                              │
│    - Test on 15% unseen data                              │
│    - Calculate: Accuracy, Precision, Recall, ROC-AUC      │
│    - Report performance                                    │
│         ↓                                                   │
│  explain.py:                                               │
│    - Feature importance (which features matter most)      │
│    - SHAP values (why each prediction)                    │
│         ↓                                                   │
│    Model Ready for Production                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓↓↓
┌─────────────────────────────────────────────────────────────┐
│                   PREDICTION PHASE                          │
│                  (When New Customer Applies)               │
│                                                             │
│  Customer Application                                      │
│  [age=35, gender="Male", income=75000, ...]              │
│         ↓                                                   │
│  Load: model.pkl + encoders.pkl                          │
│         ↓                                                   │
│  Preprocess (using saved encoders):                       │
│    [35, 1, 75000, ...]                                   │
│         ↓                                                   │
│  Model Prediction: 0.87                                   │
│  (87% confident → Approve, 13% → Reject)                 │
│         ↓                                                   │
│  Return to UI: "APPROVED - 87% confidence"                │
│  Analyst: Review and make final decision                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Real-World Example

### Scenario: Loan Application

**Customer Data:**
```
Name: Rajesh Kumar
Age: 32
Gender: Male
Monthly Income: ₹85,000
Credit Score: 750
Employment Type: Salaried
Loan Amount Requested: ₹5,00,000
Existing EMI: ₹12,000
Loan Tenure: 60 months
Debt-to-Income Ratio: 0.15
```

**How System Processes:**

**Preprocessing:**
```
Input: Dictionary with above data
Process:
  - age (32): Already number → 32
  - gender ("Male"): Use encoder → 1
  - monthly_income (85000): Already number → 85000
  - credit_score (750): Already number → 750
  - employment_type ("Salaried"): Use encoder → 2
  - ... (other 17 features)
  
Result: [32, 1, 85000, 750, 2, ...]
```

**Prediction:**
```
Input: [32, 1, 85000, 750, 2, ...]
Model: 100 decision trees voting
Process:
  Tree 1: "Probability of approval based on income and debt ratio?"
  Tree 2: "Probability considering credit score and employment?"
  ...
  Tree 100: "Final correction tree"
  
Output: All trees combine → Probability = 0.89
```

**Decision:**
```
0.89 > 0.5 → APPROVED
Confidence: 89%

Show Analyst:
  "Application: APPROVED
   Model Confidence: 89%
   Top Factors:
     + Good credit score (+0.25)
     + Stable employment (+0.18)
     + Low debt ratio (+0.15)
     - Requested amount (-0.08)
   
   Analyst Decision: APPROVE / REJECT"
```

---

## Key Takeaways

1. **This is classification ML**, not regression or clustering
2. **Preprocessing is 80% of the work** - garbage in, garbage out
3. **XGBoost is excellent for tabular financial data** - industry standard
4. **Train/Val/Test split prevents overfitting** - essential for real performance
5. **Encoders must be saved** - ensures consistency at prediction time
6. **Models are deterministic** - same input always produces same output
7. **Batch training, real-time prediction** - train once, predict many times
8. **Explainability matters** - especially for regulated industries like lending
9. **Monitor in production** - data drift and model decay are real issues
10. **Reproducibility via random_state** - same seed = same results

---

## Code Architecture Best Practices Used

✓ **Modularity**: Each function does one thing well
✓ **Reusability**: preprocess() can be called from train.py or predict.py
✓ **Configuration**: Centralized config.py prevents hardcoding
✓ **Separation of Concerns**: Different files for different stages
✓ **Reproducibility**: random_state ensures same results
✓ **Serialization**: Pickling encoders and model for production use
✓ **Type Safety**: Feature whitelist ensures only known features used

---

## Next Steps to Implement

1. **evaluate.py**: Calculate test metrics, generate evaluation report
2. **explain.py**: Feature importance and SHAP explanations
3. **predict.py**: Load model + encoders, predict new applications
4. **API Integration**: Flask/FastAPI endpoint for predictions
5. **Monitoring**: Track model accuracy over time, alert if accuracy drops
6. **Retraining**: Periodic retraining as new data arrives
