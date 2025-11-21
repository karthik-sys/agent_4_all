// Add this to the end of transactions.rs - replacing the existing complete_transaction function

// Complete/approve a transaction
pub async fn complete_transaction(
    State(state): State<Arc<AppState>>,
    Path(transaction_id): Path<String>,
) -> Result<Json<TransactionResponse>, StatusCode> {
    info!("✅ Completing transaction: {}", transaction_id);

    let transaction_uuid = Uuid::parse_str(&transaction_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Update transaction status to completed
    sqlx::query(
        "UPDATE transactions 
         SET status = 'completed', completed_at = NOW() 
         WHERE id = $1 AND status = 'pending'"
    )
    .bind(transaction_uuid)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to complete transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Fetch updated transaction with merchant_id
    let transaction = sqlx::query(
        "SELECT 
            t.id,
            t.agent_id,
            t.merchant_id,
            t.amount,
            t.currency,
            t.status,
            t.checkout_url,
            t.metadata as items,
            t.created_at,
            t.completed_at,
            a.agent_name,
            u.email as owner_email,
            u.full_name as owner_name,
            m.merchant_name
         FROM transactions t
         LEFT JOIN agents a ON a.id = t.agent_id
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN merchants m ON m.id::text = t.merchant_id
         WHERE t.id = $1"
    )
    .bind(transaction_uuid)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch completed transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let created_at: chrono::DateTime<chrono::Utc> = transaction.get("created_at");
    let completed_at: Option<chrono::NaiveDateTime> = transaction.get("completed_at");

    let response = TransactionResponse {
        id: transaction.get::<Uuid, _>("id").to_string(),
        agent_id: transaction.get("agent_id"),
        agent_name: transaction.get::<Option<String>, _>("agent_name").unwrap_or_else(|| "Unknown".to_string()),
        agent_owner_email: transaction.get::<Option<String>, _>("owner_email").unwrap_or_else(|| "Unknown".to_string()),
        agent_owner_name: transaction.get::<Option<String>, _>("owner_name").unwrap_or_else(|| "Unknown".to_string()),
        merchant_id: transaction.get("merchant_id"),
        merchant_name: transaction.get::<Option<String>, _>("merchant_name").unwrap_or_else(|| "Unknown".to_string()),
        amount: transaction.get::<rust_decimal::Decimal, _>("amount").to_string().parse().unwrap_or(0.0),
        currency: transaction.get("currency"),
        status: transaction.get("status"),
        checkout_url: transaction.get::<Option<String>, _>("checkout_url").unwrap_or_else(|| "".to_string()),
        items: transaction.get("items"),
        created_at: created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        completed_at: completed_at.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
    };

    info!("✅ Transaction completed: {}", transaction_id);
    Ok(Json(response))
}
