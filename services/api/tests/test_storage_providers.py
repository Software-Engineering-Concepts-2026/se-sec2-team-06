from __future__ import annotations

import importlib
import re

import httpx
import pytest


def _provider_module():
    try:
        return importlib.import_module("app.storage.providers")
    except ModuleNotFoundError as error:
        if error.name != "app.storage.providers":
            raise
        return None


def _local_provider_type():
    module = _provider_module()
    assert module is not None, "file storage provider contract has not been implemented"
    provider_type = getattr(module, "LocalStorageProvider", None)
    assert provider_type is not None, "local storage provider is missing"
    return provider_type


def test_local_storage_provider_round_trips_private_document_bytes(tmp_path) -> None:
    provider_type = _local_provider_type()
    provider = provider_type(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
    )
    key = provider.new_key(owner_id=17, suffix=".pdf")

    provider.put("documents", key, b"%PDF-1.4 original bytes", "application/pdf")

    assert re.fullmatch(r"[A-Za-z0-9_-]{40,50}\.pdf", key)
    assert provider.read("documents", key) == b"%PDF-1.4 original bytes"
    assert (tmp_path / "documents" / key).read_bytes() == b"%PDF-1.4 original bytes"


def test_local_storage_provider_round_trips_all_buckets(tmp_path) -> None:
    provider_type = _local_provider_type()
    directories = {
        "profile-avatars": tmp_path / "profile-images",
        "documents": tmp_path / "documents",
        "tutor-attachments": tmp_path / "tutor-attachments",
        "quiz-sources": tmp_path / "quiz-sources",
    }
    provider = provider_type(
        image_storage_dir=directories["profile-avatars"],
        document_storage_dir=directories["documents"],
        tutor_attachment_storage_dir=directories["tutor-attachments"],
        quiz_source_storage_dir=directories["quiz-sources"],
    )
    samples = {
        "profile-avatars": (".webp", b"avatar bytes", "image/webp"),
        "documents": (".pdf", b"document bytes", "application/pdf"),
        "tutor-attachments": (".jpg", b"tutor image bytes", "image/jpeg"),
        "quiz-sources": (".txt", b"quiz source bytes", "text/plain"),
    }

    for bucket, (suffix, content, content_type) in samples.items():
        key = provider.new_key(owner_id=17, suffix=suffix)
        provider.put(bucket, key, content, content_type)
        assert provider.read(bucket, key) == content
        assert (directories[bucket] / key).read_bytes() == content


def test_local_storage_provider_generates_safe_keys_and_scopes_buckets(tmp_path) -> None:
    provider_type = _local_provider_type()
    provider = provider_type(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
    )

    image_key = provider.new_key(owner_id=17, suffix=".webp")
    document_key = provider.new_key(owner_id=17, suffix=".pdf")
    provider.put("profile-avatars", image_key, b"avatar", "image/webp")
    provider.put("documents", document_key, b"document", "application/pdf")

    assert image_key != document_key
    assert (tmp_path / "profile-images" / image_key).read_bytes() == b"avatar"
    assert (tmp_path / "documents" / document_key).read_bytes() == b"document"
    assert ".." not in image_key and "/" not in image_key and "\\" not in image_key


def test_local_storage_provider_missing_object_raises_not_found(tmp_path) -> None:
    provider_type = _local_provider_type()
    provider = provider_type(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
    )

    missing_key = provider.new_key(owner_id=17)
    with pytest.raises(FileNotFoundError):
        provider.read("documents", missing_key)


def test_local_storage_provider_delete_is_idempotent(tmp_path) -> None:
    provider_type = _local_provider_type()
    provider = provider_type(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
    )
    key = provider.new_key(owner_id=17, suffix=".txt")
    provider.put("documents", key, b"notes", "text/plain")

    provider.delete("documents", key)
    provider.delete("documents", key)

    with pytest.raises(FileNotFoundError):
        provider.read("documents", key)


def test_storage_provider_uses_local_files_without_supabase_credentials(tmp_path) -> None:
    module = _provider_module()
    assert module is not None, "file storage provider contract has not been implemented"
    provider = module.create_storage_provider(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
        supabase_url=None,
        supabase_secret_key=None,
    )

    assert isinstance(provider, module.LocalStorageProvider)


def test_storage_provider_rejects_partial_supabase_configuration(tmp_path) -> None:
    module = _provider_module()
    assert module is not None, "file storage provider contract has not been implemented"

    with pytest.raises(module.StorageConfigurationError, match="SUPABASE_URL.*SUPABASE_SECRET_KEY"):
        module.create_storage_provider(
            image_storage_dir=tmp_path / "profile-images",
            document_storage_dir=tmp_path / "documents",
            supabase_url="https://project.supabase.co",
            supabase_secret_key=None,
        )


def test_supabase_backend_rejects_partial_credentials(tmp_path) -> None:
    module = _provider_module()
    assert module is not None

    with pytest.raises(module.StorageConfigurationError, match="SUPABASE_URL.*SUPABASE_SECRET_KEY"):
        module.create_storage_provider(
            image_storage_dir=tmp_path / "profile-images",
            document_storage_dir=tmp_path / "documents",
            tutor_attachment_storage_dir=tmp_path / "tutor-attachments",
            quiz_source_storage_dir=tmp_path / "quiz-sources",
            supabase_url="https://project.supabase.co",
            supabase_secret_key=None,
            storage_backend="supabase",
            is_render=False,
        )


def test_local_backend_remains_available_outside_render(tmp_path) -> None:
    module = _provider_module()
    provider_type = _supabase_provider_type()
    assert module is not None

    local_provider = module.create_storage_provider(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
        tutor_attachment_storage_dir=tmp_path / "tutor-attachments",
        quiz_source_storage_dir=tmp_path / "quiz-sources",
        supabase_url=None,
        supabase_secret_key=None,
        storage_backend="local",
        is_render=False,
    )
    cloud_provider = module.create_storage_provider(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
        tutor_attachment_storage_dir=tmp_path / "tutor-attachments",
        quiz_source_storage_dir=tmp_path / "quiz-sources",
        supabase_url="https://project.supabase.co",
        supabase_secret_key="sb_secret_test_key",
        storage_backend=None,
        is_render=False,
    )

    assert isinstance(local_provider, module.LocalStorageProvider)
    assert isinstance(cloud_provider, provider_type)
    cloud_provider.close()


def test_supabase_storage_maps_every_bucket_name() -> None:
    provider_type = _supabase_provider_type()
    requests: list[httpx.Request] = []
    samples = {
        "profile-avatars": ".jpg",
        "documents": ".pdf",
        "tutor-attachments": ".webp",
        "quiz-sources": ".docx",
    }

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"Key": "object"})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", "sb_secret_test_key", client=client)
        for bucket, suffix in samples.items():
            key = f"17/{'x' * 44}{suffix}"
            provider.put(bucket, key, b"bytes", "application/octet-stream")

    assert [request.url.path for request in requests] == [
        f"/storage/v1/object/{bucket}/17/{'x' * 44}{suffix}"
        for bucket, suffix in samples.items()
    ]


def _supabase_provider_type():
    try:
        module = importlib.import_module("app.storage.supabase_storage")
    except ModuleNotFoundError as error:
        if error.name != "app.storage.supabase_storage":
            raise
        module = None
    assert module is not None, "Supabase Storage provider has not been implemented"
    provider_type = getattr(module, "SupabaseStorageProvider", None)
    assert provider_type is not None, "Supabase Storage provider is missing"
    return provider_type


def test_supabase_storage_upload_uses_owner_scoped_key_and_secret_apikey_only() -> None:
    provider_type = _supabase_provider_type()
    secret = "sb_secret_test_key_never_echo"
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"Key": "documents/17/object"})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", secret, client=client)
        key = provider.new_key(owner_id=17)
        provider.put("documents", key, b"original", "application/pdf")

    request = requests[0]
    assert key.startswith("17/")
    assert len(key) <= 64
    assert re.fullmatch(r"17/[A-Za-z0-9_-]{40,50}", key)
    assert request.method == "POST"
    assert request.url.path == f"/storage/v1/object/documents/{key}"
    assert request.headers["apikey"] == secret
    assert "authorization" not in request.headers
    assert request.headers["content-type"] == "application/pdf"
    assert request.content == b"original"


def test_supabase_storage_reads_original_from_private_authenticated_endpoint() -> None:
    provider_type = _supabase_provider_type()
    secret = "sb_secret_test_key_never_echo"
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, content=b"original pdf bytes")

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", secret, client=client)
        result = provider.read("documents", "17/opaque-object-key-12345678901234567890123456789012345")

    assert result == b"original pdf bytes"
    assert requests[0].method == "GET"
    assert requests[0].url.path.endswith(
        "/storage/v1/object/authenticated/documents/17/opaque-object-key-12345678901234567890123456789012345"
    )
    assert requests[0].headers["apikey"] == secret
    assert "authorization" not in requests[0].headers


def test_supabase_storage_deletes_only_the_selected_private_object() -> None:
    provider_type = _supabase_provider_type()
    secret = "sb_secret_test_key_never_echo"
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"message": "deleted"})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", secret, client=client)
        provider.delete("profile-avatars", "17/opaque-avatar-123456789012345678901234567890123456.jpg")

    assert len(requests) == 1
    assert requests[0].method == "DELETE"
    assert requests[0].url.path.endswith(
        "/storage/v1/object/profile-avatars/17/opaque-avatar-123456789012345678901234567890123456.jpg"
    )
    assert requests[0].headers["apikey"] == secret
    assert "authorization" not in requests[0].headers


def test_supabase_storage_maps_missing_objects_without_leaking_response_body() -> None:
    provider_type = _supabase_provider_type()

    def respond(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="private object missing")

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", "sb_secret_test_key", client=client)
        with pytest.raises(FileNotFoundError, match="not found"):
            provider.read("documents", "17/opaque-object-key-12345678901234567890123456789012345")


def test_supabase_storage_upload_404_is_a_provider_error_not_a_missing_object() -> None:
    provider_module = _provider_module()
    provider_type = _supabase_provider_type()
    assert provider_module is not None
    response_body = "bucket does not exist"

    def respond(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text=response_body)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", "sb_secret_test_key", client=client)
        with pytest.raises(provider_module.StorageProviderError, match="HTTP 404") as failure:
            provider.put(
                "tutor-attachments",
                "17/opaque-image-key-12345678901234567890123456789012345.jpg",
                b"image bytes",
                "image/jpeg",
            )

    assert response_body not in str(failure.value)


def test_supabase_storage_translates_server_errors_without_echoing_secrets() -> None:
    provider_type = _supabase_provider_type()
    secret = "sb_secret_do_not_disclose_982"

    def respond(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text=f"upstream diagnostic contains {secret}")

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = provider_type("https://project.supabase.co", secret, client=client)
        with pytest.raises(RuntimeError) as failure:
            provider.read("documents", "17/opaque-object-key-12345678901234567890123456789012345")

    assert "503" in str(failure.value)
    assert secret not in str(failure.value)


def test_supabase_storage_translates_transport_timeouts() -> None:
    provider_type = _supabase_provider_type()

    def time_out(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("upstream timeout")

    with httpx.Client(transport=httpx.MockTransport(time_out)) as client:
        provider = provider_type("https://project.supabase.co", "sb_secret_test_key", client=client)
        with pytest.raises(RuntimeError, match="temporarily unavailable"):
            provider.read("documents", "17/opaque-object-key-12345678901234567890123456789012345")


def test_storage_provider_selects_supabase_when_both_cloud_settings_exist(tmp_path) -> None:
    module = _provider_module()
    provider_type = _supabase_provider_type()
    assert module is not None
    provider = module.create_storage_provider(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
        supabase_url="https://project.supabase.co",
        supabase_secret_key="sb_secret_test_key",
    )

    assert isinstance(provider, provider_type)
    provider.close()
