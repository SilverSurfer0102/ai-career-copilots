def test_create_and_get_profile(client):
    res = client.post("/profiles", json={"display_name": "Jane Doe", "email": "jane@example.com"})
    assert res.status_code == 201
    profile = res.json()
    assert profile["display_name"] == "Jane Doe"
    assert profile["email"] == "jane@example.com"
    assert "id" in profile

    get_res = client.get(f"/profiles/{profile['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == profile["id"]


def test_update_profile(client):
    res = client.post("/profiles", json={"display_name": "John Smith"})
    profile_id = res.json()["id"]

    patch_res = client.patch(f"/profiles/{profile_id}", json={"location": "Berlin, Germany"})
    assert patch_res.status_code == 200
    assert patch_res.json()["location"] == "Berlin, Germany"


def test_profile_not_found(client):
    res = client.get("/profiles/nonexistent-id")
    assert res.status_code == 404


def test_list_profiles(client):
    client.post("/profiles", json={"display_name": "Alice"})
    client.post("/profiles", json={"display_name": "Bob"})
    res = client.get("/profiles")
    assert res.status_code == 200
    assert len(res.json()) >= 2


def test_get_profile_blocks_empty(client):
    res = client.post("/profiles", json={"display_name": "Empty Profile"})
    profile_id = res.json()["id"]
    blocks_res = client.get(f"/profiles/{profile_id}/blocks")
    assert blocks_res.status_code == 200
    blocks = blocks_res.json()
    assert blocks["experiences"] == []
    assert blocks["skills"] == []
