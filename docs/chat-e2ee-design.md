# Chat End-to-End Encryption (E2EE) Design

This document outlines the cryptographic specifications and threat model for implementing true End-to-End Encryption (E2EE) in Jesmond 2.0.

> [!WARNING]
> The current implementation uses a Base64 stub in place of actual E2EE payloads to test UI and data flow. It is **NOT PRODUCTION READY**.

## 1. Threat Model & Assumptions
*   **Server Compromise:** The backend API and database may be fully compromised. The server must never have access to plaintext messages or private keys.
*   **Database Leaks:** If the database is leaked, an attacker should only see opaque ciphertext strings and standard metadata (timestamps, participant IDs).
*   **Metadata Visibility:** The server inherently knows *who* is talking to *whom*, *when* messages are sent, and the *length* of the ciphertext.

## 2. Cryptographic Protocol
We will utilize the **Double Ratchet Algorithm** paired with **X3DH** (Extended Triple Diffie-Hellman) for key exchange.
*   **WebCrypto API:** All cryptographic operations will occur client-side in the browser using the native WebCrypto API.
*   **Primitives:**
    *   Symmetric Encryption: `AES-GCM` (256-bit)
    *   Key Derivation: `HKDF-SHA256`
    *   Asymmetric Exchange: `ECDH` over `Curve25519`
    *   Digital Signatures: `Ed25519`

## 3. Client Key Generation
Upon initial registration or device setup, the client generates:
1.  **Identity Key Pair** (Long-term Ed25519 pair)
2.  **Signed Pre-Key** (Medium-term ECDH pair, signed by Identity Key)
3.  **One-Time Pre-Keys** (Batch of short-lived ECDH pairs)

The public components of these keys are uploaded to the server (`/api/v1/chat/keys`). The private keys NEVER leave the device's secure storage (IndexedDB).

## 4. Key Exchange (X3DH)
When Student Alice wants to message Host Bob:
1.  Alice fetches Bob's public Identity Key, Signed Pre-Key, and one One-Time Pre-Key from the server.
2.  Alice performs the X3DH exchange to establish a **Shared Secret**.
3.  Alice initializes the Double Ratchet session using this Shared Secret.

## 5. Conversation Key & Message Encryption
*   **Authenticated Encryption:** Each message is encrypted using `AES-GCM` with a unique message key derived from the Ratchet.
*   **Nonce/IV Handling:** A secure random 96-bit IV is generated for each `AES-GCM` operation and prepended to the ciphertext payload.
*   **Forward Secrecy:** The symmetric Ratchet state advances with every message sent or received. Compromising a device's current key state does not compromise past messages.
*   **Post-Compromise Security:** Every new message includes a new ephemeral public key, performing a new Diffie-Hellman step to heal the session if keys were compromised.

## 6. Multi-Device & Account Management
*   **Multiple Devices:** Each device has its own Identity Key Pair. When Alice sends a message, she must encrypt it individually for Bob's Phone, Bob's Laptop, and Alice's Laptop (using the Sesame algorithm or pairwise ratchets).
*   **New Device / Login:** A new login generates a new device keypair. Past messages are not retrievable on the new device unless securely migrated or backed up client-side.
*   **Lost Device / Logout:** Revoking a device deletes its public keys from the server. Senders will stop encrypting messages for the revoked device.

## 7. Participant Changes & Property Lifecycle
*   **Property Disabled:** If a property is disabled or unpublished, the API will reject new messages (`403 Forbidden`). Existing ciphertexts remain stored.
*   **Participant Changes:** If a new property manager is added, they generate a new device key. Existing participants will fetch this new key and encrypt future messages for them. Past messages are inaccessible to the new manager.

## 8. Data Stored on Server
The `Message` table stores:
*   `encryptedPayload`: The `AES-GCM` ciphertext.
*   `iv`: The 96-bit initialization vector.
*   `senderId`, `conversationId`, `createdAt` (Metadata).

No plaintext or private keys are ever transmitted or stored.
