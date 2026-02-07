import logging
import ssl
import httpx
import kopf
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


class AgentClient:
    """HTTP client with mTLS for control plane communication"""

    def __init__(self, base_url: str, cert_path: str, key_path: str, ca_path: str):
        self.base_url = base_url
        self.cert_path = cert_path
        self.key_path = key_path
        self.ca_path = ca_path
        self.workspace_id: Optional[str] = None
        self._client: Optional[httpx.Client] = None

        logger.info(
            f"Using cert_path={cert_path} key_path={key_path} ca_path={ca_path}"
        )

    def _validate_certificate_files(self) -> bool:
        """Verify certificate files exist and certificate is not expired"""
        try:
            # Check files exist
            if not all(
                Path(p).exists() for p in [self.cert_path, self.key_path, self.ca_path]
            ):
                logger.error("One or more certificate files not found")
                return False

            # Check certificate expiration
            cert_data = Path(self.cert_path).read_bytes()
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())

            now = datetime.now(timezone.utc)
            if cert.not_valid_after_utc <= now:
                logger.error("Certificate has expired")
                return False

            # Warn if expiring soon
            days_until_expiry = (cert.not_valid_after_utc - now).days
            if days_until_expiry < 7:
                logger.warning(f"Certificate expires in {days_until_expiry} days")

            logger.info(f"Certificate valid until {cert.not_valid_after_utc}")
            return True

        except Exception as e:
            logger.error(f"Error validating certificate: {e}")
            return False

    def create_mtls_client(self, ca: str, cert: str, key: str) -> httpx.Client:
        ctx = ssl.create_default_context(
            purpose=ssl.Purpose.SERVER_AUTH,
            cafile=ca,
        )
        ctx.load_cert_chain(cert, key)
        ctx.verify_mode = ssl.CERT_REQUIRED
        ctx.check_hostname = True

        transport = httpx.HTTPTransport(verify=ctx)
        return httpx.Client(base_url=self.base_url, transport=transport)

    def initialize(self) -> None:
        """Initialize mTLS client"""
        # Validate certificates
        if not self._validate_certificate_files():
            raise RuntimeError("Certificate validation failed")

        # Close existing client if any
        if self._client:
            self._client.close()

        # Create mTLS client
        self._client = self.create_mtls_client(
            ca=self.ca_path, cert=self.cert_path, key=self.key_path
        )

        logger.info(f"mTLS client initialized")

    @property
    def client(self) -> httpx.Client:
        """Get the underlying HTTP client"""
        if not self._client:
            raise RuntimeError("Client not initialized. Call initialize() first.")
        return self._client

    def sync_and_fetch(self, status_data: Dict[str, Any]) -> None:
        """Send status report to control plane"""
        response = self.client.post(f"/api/v1/agent/sync", json=status_data)
        json_ = response.json()
        logger.info(json_)
        response.raise_for_status()
        return json_

    def close(self) -> None:
        """Close the HTTP client"""
        if self._client:
            self._client.close()
            self._client = None
            logger.info("mTLS client closed")
