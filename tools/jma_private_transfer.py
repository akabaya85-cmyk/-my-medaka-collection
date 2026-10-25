#!/usr/bin/env python3
"""Encrypt a source manual for transient private processing.

No PDF or images may be committed or published in readable form.
Encrypted blob is only decryptable with the private key kept off GitHub.
"""
import os,struct,requests
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
URL="https://jma-medaka.com/wp-content/uploads/2022/08/250901_%E3%80%90%E5%85%AC%E5%BC%8F%E3%80%91%E5%93%81%E7%A8%AE%E5%88%86%E9%A1%9E%E3%83%9E%E3%83%8B%E3%83%A5%E3%82%A2%E3%83%AB_%E7%AC%AC%EF%BC%95%E7%89%88.pdf"
PUBLIC_KEY='''-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAtHw4roi8XQhFgv1EFB5v
axZP2B9uKkN4YUTTBTh3n8efBYEQ6e/O8VblhvEPAMgUaV1iSAlVVOau8gV1lpfC
heRzmMLPAfWJ51N4UIHY/QhkDhYQPyz2NL/DuN3ZcSSWHswDAfArQtx7fQlswy3G
NCtroAnAeENQtCJADbR8wB8wu6W4vsyMoH2b4txB12JnRyR8on+o4qJ7ffshvPSf
9huhbfGVgYqvZ/UBLv15zf+ZbAAQ6MJaZspatl7fO2h51fhqOCXXZfcuV5L2ikQA
bavCo8VBlvFEDxTgGt7FKMwTxXgbGUkTfC3QT9O/DgPTYJsAzGKoW+8Kmjouzpwc
u45agXrundFsP9oj5ypA1qonC2wObk+185Zk+LJdrZNtXVDXEiFUh//QBLOXNsKC
lkqrnjsCp2gDE0/ExJ4VG1LODRvP7lhdRYeR9qEMXzz5iW7wb4Qir/CBRo1ObOoS
kKNCOwh8LVoRvFy/BFkYDkspCTc/jmkOYONAx+jDaCrjAgMBAAE=
-----END PUBLIC KEY-----'''
r=requests.get(URL,timeout=45,headers={'User-Agent':'MyMedakaCollection/1.0 private noncommercial source audit'})
r.raise_for_status()
raw=r.content
if not raw.startswith(b'%PDF'):raise RuntimeError('Invalid PDF source')
public=serialization.load_pem_public_key(PUBLIC_KEY.encode())
aes_key=os.urandom(32)
nonce=os.urandom(12)
encrypted=AESGCM(aes_key).encrypt(nonce,raw,b'JMA-MEDAKA-V5-PRIVATE')
wrapped=public.encrypt(aes_key,padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
out=b'JMAENC1'+struct.pack('>H',len(wrapped))+wrapped+nonce+encrypted
Path('private_source').mkdir(exist_ok=True)
Path('private_source/manual.enc').write_bytes(out)
print('source PDF size',len(raw),'encrypted container size',len(out),'plain source not retained',flush=True)
