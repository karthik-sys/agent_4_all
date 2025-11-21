with open('network.rs', 'r') as f:
    content = f.read()

# Update GraphNode to include multiple teams
old_struct = '''pub struct GraphNode {
    pub id: String,
    pub node_type: String, // "agent" or "merchant"
    pub label: String,
    pub foundational_model: Option<String>,
    pub tier: Option<String>,
    pub team_id: Option<String>,
    pub team_color: Option<String>,
    pub stats: NodeStats,
}'''

new_struct = '''pub struct GraphNode {
    pub id: String,
    pub node_type: String, // "agent" or "merchant"
    pub label: String,
    pub foundational_model: Option<String>,
    pub tier: Option<String>,
    pub team_id: Option<String>,
    pub team_color: Option<String>,
    pub team_ids: Vec<String>,
    pub team_names: Vec<String>,
    pub team_colors: Vec<String>,
    pub stats: NodeStats,
}'''

content = content.replace(old_struct, new_struct)

# Now update the query to get ALL teams
old_query = '''    let agent_rows = sqlx::query(
        "SELECT 
            a.id, a.agent_name, a.foundational_model, a.tier, a.risk_score,
            a.transaction_count,
            COALESCE(t.id, NULL) as team_id,
            COALESCE(t.team_color, NULL) as team_color,'''

new_query = '''    let agent_rows = sqlx::query(
        "SELECT 
            a.id, a.agent_name, a.foundational_model, a.tier, a.risk_score,
            a.transaction_count,
            COALESCE(t.id, NULL) as team_id,
            COALESCE(t.team_color, NULL) as team_color,
            COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), ARRAY[]::uuid[]) as team_ids,
            COALESCE(array_agg(DISTINCT t.team_name) FILTER (WHERE t.team_name IS NOT NULL), ARRAY[]::text[]) as team_names,
            COALESCE(array_agg(DISTINCT t.team_color) FILTER (WHERE t.team_color IS NOT NULL), ARRAY[]::text[]) as team_colors,'''

content = content.replace(old_query, new_query)

# Update the GraphNode creation
old_node = '''nodes.push(GraphNode {
            id: row.get("id"),
            node_type: "agent".to_string(),
            label: row.get("agent_name"),
            foundational_model: row.get("foundational_model"),
            tier: Some(row.get("tier")),
            team_id: row.get::<Option<Uuid>, _>("team_id").map(|id| id.to_string()),
            team_color: row.get("team_color"),
            stats: NodeStats {
                transaction_count: row.get("transaction_count"),
                win_count: row.get("win_count"),
                avg_price: row.get::<rust_decimal::Decimal, _>("avg_price").to_string().parse().unwrap_or(0.0),
                risk_score: row.get("risk_score"),
                last_item: None,  // TODO: Query from transactions table
            },
        });'''

new_node = '''let team_ids: Vec<Uuid> = row.try_get("team_ids").unwrap_or_default();
        let team_names: Vec<String> = row.try_get("team_names").unwrap_or_default();
        let team_colors: Vec<String> = row.try_get("team_colors").unwrap_or_default();
        
        nodes.push(GraphNode {
            id: row.get("id"),
            node_type: "agent".to_string(),
            label: row.get("agent_name"),
            foundational_model: row.get("foundational_model"),
            tier: Some(row.get("tier")),
            team_id: team_ids.first().map(|id| id.to_string()),
            team_color: team_colors.last().map(|c| c.clone()),
            team_ids: team_ids.iter().map(|id| id.to_string()).collect(),
            team_names: team_names.clone(),
            team_colors: team_colors.clone(),
            stats: NodeStats {
                transaction_count: row.get("transaction_count"),
                win_count: row.get("win_count"),
                avg_price: row.get::<rust_decimal::Decimal, _>("avg_price").to_string().parse().unwrap_or(0.0),
                risk_score: row.get("risk_score"),
                last_item: None,
            },
        });'''

content = content.replace(old_node, new_node)

# Also update merchant nodes
old_merchant = '''nodes.push(GraphNode {
            id: row.get::<Uuid, _>("id").to_string(),
            node_type: "merchant".to_string(),
            label: row.get("merchant_name"),
            foundational_model: None,
            tier: None,
            team_id: None,
            team_color: None,
            stats: NodeStats {
                transaction_count: row.get("tx_count"),
                win_count: 0,
                avg_price: 0.0,
                risk_score: 0,
                last_item: None,
            },
        });'''

new_merchant = '''nodes.push(GraphNode {
            id: row.get::<Uuid, _>("id").to_string(),
            node_type: "merchant".to_string(),
            label: row.get("merchant_name"),
            foundational_model: None,
            tier: None,
            team_id: None,
            team_color: None,
            team_ids: vec![],
            team_names: vec![],
            team_colors: vec![],
            stats: NodeStats {
                transaction_count: row.get("tx_count"),
                win_count: 0,
                avg_price: 0.0,
                risk_score: 0,
                last_item: None,
            },
        });'''

content = content.replace(old_merchant, new_merchant)

with open('network.rs', 'w') as f:
    f.write(content)

print("✅ Backend updated to return all teams for each agent")
