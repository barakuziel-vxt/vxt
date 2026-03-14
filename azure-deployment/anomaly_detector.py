import pyodbc
import pandas as pd
import numpy as np

# הגדרות חיבור ל-SQL Edge
SQL_CONN_STR = (
    'DRIVER={SQL Server};'
    'SERVER=127.0.0.1;'
    'DATABASE=master;'
    'UID=sa;'
    'PWD=YourStrongPassword123!'
)

def detect_anomalies():
    try:
        # 1. משיכת נתונים מה-SQL לתוך Pandas DataFrame
        conn = pyodbc.connect(SQL_CONN_STR)
        query = "SELECT Timestamp, CoolantTempC, EngineRPM FROM BoatTelemetry ORDER BY Timestamp DESC"
        df = pd.read_sql(query, conn)
        conn.close()

        if df.empty:
            print("No data found to analyze.")
            return

        # 2. חישוב סטטיסטי בסיסי (Z-Score)
        # אנחנו מחפשים חריגות בטמפרטורה
        mean_temp = df['CoolantTempC'].mean()
        std_temp = df['CoolantTempC'].std()

        # הגדרת סף: 2 סטיות תקן מהממוצע (מכסה ~95% מהמקרים התקינים)
        threshold = 2 
        
        # חישוב ה-Z-Score לכל שורה
        df['z_score'] = (df['CoolantTempC'] - mean_temp) / std_temp
        df['is_anomaly'] = df['z_score'].abs() > threshold

        # 3. הצגת תוצאות
        anomalies = df[df['is_anomaly'] == True]
        
        print(f"--- Engine Health Analysis ---")
        print(f"Mean Temp: {mean_temp:.2f}C | Std Dev: {std_temp:.2f}C")
        print(f"Analyzed {len(df)} data points.")
        
        if not anomalies.empty:
            print(f"!!! FOUND {len(anomalies)} ANOMALIES !!!")
            print(anomalies[['Timestamp', 'CoolantTempC', 'z_score']].head())
        else:
            print("Status: All systems normal.")

    except Exception as e:
        print(f"Error during anomaly detection: {e}")

if __name__ == "__main__":
    # ב-PoC אפשר להריץ את זה בלופ או פעם אחת כ-Job
    detect_anomalies()