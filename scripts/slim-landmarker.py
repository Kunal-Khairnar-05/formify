"""Rebuild public/models/face_landmarker.task from Google's original bundle, without the
blendshapes network.

The original .task file is a zip of three networks. Formify uses the face detector and the
landmark network; the blendshapes network (facial expressions, about 1 MB) is never run.
Usage: python scripts/slim-landmarker.py path/to/original/face_landmarker.task
The output is byte-for-byte the same on every machine, so its checksum in MODELS.md holds.
"""
import hashlib
import sys
import zipfile

DROP = {'face_blendshapes.tflite'}
OUT = 'public/models/face_landmarker.task'

source = zipfile.ZipFile(sys.argv[1])
entries = [(i.filename, source.read(i.filename)) for i in source.infolist() if i.filename not in DROP]
source.close()

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_STORED) as out:
    for name, data in entries:
        # fixed date and attributes: the defaults depend on the clock and the operating system
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED
        info.create_system = 0
        info.external_attr = 0
        out.writestr(info, data)

with open(OUT, 'rb') as f:
    data = f.read()
print(f'{OUT}: {len(data)} bytes, sha256 {hashlib.sha256(data).hexdigest()}')
