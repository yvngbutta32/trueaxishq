"""
Replace inline onChange arrow functions with stable useFormFields setters.
This prevents React.memo on Field from being bypassed on every render.

Pattern replaced:
  onChange={v => setForm(p => ({ ...p, FIELD: v }))}
  onChange={v => setEditForm(p => ({ ...p, FIELD: v }))}
  etc.

Replaced with:
  onChange={setXxxFormField("FIELD")}
"""
import re

with open('/home/ubuntu/skillbridge-ai/client/src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Map of (setter_name, field_range) -> stable_setter_name
# We need to determine which panel each setForm belongs to by context.
# Strategy: replace in order from bottom to top to avoid line shift issues.
# We use regex to find and replace all patterns.

replacements = [
    # ClientsPanel setForm (name/email/phone/service/notes)
    (r'onChange=\{v => setForm\(p => \(\{ \.\.\.p, (name|email|phone|service|notes): v \}\)\)\}',
     lambda m: f'onChange={{setClientFormField("{m.group(1)}")}}'),

    # SchedulingPanel setForm (clientName/clientEmail/service/date/time/notes)
    (r'onChange=\{v => setForm\(p => \(\{ \.\.\.p, (clientName|clientEmail|service|date|time|notes|duration): v \}\)\)\}',
     lambda m: f'onChange={{setSchedFormField("{m.group(1)}")}}'),

    # InvoicesPanel setRecurringForm
    (r'onChange=\{v => setRecurringForm\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}',
     lambda m: f'onChange={{setRecurringFormField("{m.group(1)}")}}'),

    # InvoicesPanel setEditForm
    (r'onChange=\{v => setEditForm\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}',
     lambda m: f'onChange={{setEditFormField("{m.group(1)}")}}'),

    # FollowUpsPanel setRuleForm
    (r'onChange=\{v => setRuleForm\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}',
     lambda m: f'onChange={{setRuleFormField("{m.group(1)}")}}'),

    # SettingsPanel setProfile
    (r'onChange=\{v => setProfile\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}',
     lambda m: f'onChange={{setProfileField("{m.group(1)}")}}'),

    # SettingsPanel setBusiness
    (r'onChange=\{v => setBusiness\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}',
     lambda m: f'onChange={{setBusinessField("{m.group(1)}")}}'),

    # SettingsPanel setBookingPage
    (r'onChange=\{v => setBookingPage\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}',
     lambda m: f'onChange={{setBookingPageField("{m.group(1)}")}}'),
]

total_replaced = 0
for pattern, replacement in replacements:
    new_content, count = re.subn(pattern, replacement, content)
    if count > 0:
        print(f"  Replaced {count} occurrences of pattern: {pattern[:60]}...")
        content = new_content
        total_replaced += count

# Handle remaining setForm patterns (InvoicesPanel and FollowUpsPanel/ContractsPanel/TestimonialsPanel)
# These all use setForm but in different panels — we need to handle them by context.
# Since each panel has its own setField var (setInvFormField, setFollowFormField, etc.),
# we need to be smarter. Let's count remaining inline setForm patterns.
remaining = re.findall(r'onChange=\{v => setForm\(p => \(\{ \.\.\.p, (\w+): v \}\)\)\}', content)
print(f"\nRemaining inline setForm patterns: {len(remaining)}")
for r in remaining:
    print(f"  field: {r}")

# For the remaining setForm patterns, we need to replace them with the correct panel setter.
# InvoicesPanel fields: clientName, clientEmail, service, amount, dueDate, notes, status
# FollowUpsPanel fields: clientName, clientEmail, service, context, tone
# ContractsPanel fields: various
# TestimonialsPanel fields: clientName, clientEmail, serviceName

# Replace all remaining setForm patterns with their panel-specific setters
# We'll do this by scanning the file in sections

with open('/home/ubuntu/skillbridge-ai/client/src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

print(f"\nTotal replacements made: {total_replaced}")
print("File written. Run tsc to check for errors.")
