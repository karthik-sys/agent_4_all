with open('network.rs', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    
    # Add last_item to NodeStats struct
    if 'pub risk_score: i32,' in line and i+1 < len(lines) and '}' in lines[i+1]:
        new_lines.append('    pub last_item: Option<String>,\n')
    
    # Add last_item: None to all NodeStats initializations
    if 'risk_score: row.get("risk_score"),' in line:
        new_lines.append(line.replace('risk_score', 'last_item').replace('row.get("risk_score")', 'None'))
    elif 'risk_score: 0,' in line:
        new_lines.append(line.replace('risk_score: 0', 'last_item: None'))

with open('network.rs', 'w') as f:
    f.writelines(new_lines)

print("✅ Minimal safe patch applied")
