with open("frontend/app/advisor/Submissions.tsx", "r") as f:
    content = f.read()

old_str = "complianceComments[selectedDocument.name || selectedDocument.filename] ||\n                  'Document received and queued for compliance review.'"
new_str = "selectedDocument.officer_comment ||\n                  'Document received and queued for compliance review.'"

content = content.replace(old_str, new_str)

# Also let's double check if we need to remove the complianceComments dictionary if we didn't before.
# It seems I did remove it. 
# Wait, let's just use string replace.
with open("frontend/app/advisor/Submissions.tsx", "w") as f:
    f.write(content)
