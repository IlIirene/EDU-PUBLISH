import json

# Read the config file with utf-8-sig to handle BOM
with open('/AstrBot/data/config/astrbot-QQtoLocal_config.json', 'r', encoding='utf-8-sig') as f:
    config = json.load(f)

# Update the configuration
config['banshi_group_list'] = ['684505231']
config['archive_root'] = '/workspace/archive'

# Write back
with open('/AstrBot/data/config/astrbot-QQtoLocal_config.json', 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=4, ensure_ascii=False)

print("Configuration updated successfully")