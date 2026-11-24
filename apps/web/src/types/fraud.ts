/** Shapes returned by fraud-service's admin API (fields vary slightly between endpoints). */
export interface FraudStats {
  total_signals?: number;
  signals_today?: number;
  high_risk_users?: number;
  anomalies_detected?: number;
  blocked_users?: number;
  locked_accounts?: number;
}

export interface FraudSignal {
  user_id?: string;
  signal_type?: string;
  type?: string;
  severity?: string;
  created_at?: string;
  timestamp?: string;
}

export interface RiskFactor {
  type?: string;
  description?: string;
  timestamp?: string;
}

export interface RiskData {
  score?: number;
  risk_score?: number;
  // Older records store factors as plain strings.
  factors?: (RiskFactor | string)[];
  risk_factors?: (RiskFactor | string)[];
}
