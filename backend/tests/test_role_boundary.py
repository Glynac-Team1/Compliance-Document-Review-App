# backend/tests/test_role_boundary.py
async def test_advisor_cannot_hit_officer_endpoint(client, advisor_token):
    resp = await client.get("/queue", headers={"Authorization": f"Bearer {advisor_token}"})
    assert resp.status_code == 403

async def test_officer_cannot_hit_advisor_endpoint(client, officer_token):
    resp = await client.get("/documents/mine", headers={"Authorization": f"Bearer {officer_token}"})
    assert resp.status_code == 403
