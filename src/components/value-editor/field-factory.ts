/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import ArraybufferField from './fields/arraybuffer-field';
import ArrayField from './fields/array-field';
import BigintField from './fields/bigint-field';
import Bigint64arrayField from './fields/bigint64array-field';
import Biguint64arrayField from './fields/biguint64array-field';
import BlobField from './fields/blob-field';
import BooleanField from './fields/boolean-field';
import CryptokeyField from './fields/cryptokey-field';
import DataviewField from './fields/dataview-field';
import DateField from './fields/date-field';
import DomexceptionField from './fields/domexception-field';
import DommatrixField from './fields/dommatrix-field';
import DommatrixreadonlyField from './fields/dommatrixreadonly-field';
import DompointField from './fields/dompoint-field';
import DompointreadonlyField from './fields/dompointreadonly-field';
import DomquadField from './fields/domquad-field';
import DomrectField from './fields/domrect-field';
import DomrectreadonlyField from './fields/domrectreadonly-field';
import ErrorField from './fields/error-field';
import Field, { type ValueFieldArgs } from './fields/field';
import FileField from './fields/file-field';
import FilelistField from './fields/filelist-field';
import FilesystemdirectoryhandleField from './fields/filesystemdirectoryhandle-field';
import FilesystemfilehandleField from './fields/filesystemfilehandle-field';
import Float16arrayField from './fields/float16array-field';
import Float32arrayField from './fields/float32array-field';
import Float64arrayField from './fields/float64array-field';
import ImagebitmapField from './fields/imagebitmap-field';
import ImagedataField from './fields/imagedata-field';
import Int16arrayField from './fields/int16array-field';
import Int32arrayField from './fields/int32array-field';
import Int8arrayField from './fields/int8array-field';
import NullField from './fields/null-field';
import NumberField from './fields/number-field';
import MapField from './fields/map-field';
import ObjectField from './fields/object-field';
import RegexpField from './fields/regexp-field';
import RtccertificateField from './fields/rtccertificate-field';
import SetField from './fields/set-field';
import StringField from './fields/string-field';
import Uint16arrayField from './fields/uint16array-field';
import Uint32arrayField from './fields/uint32array-field';
import Uint8arrayField from './fields/uint8array-field';
import Uint8clampedarrayField from './fields/uint8clampedarray-field';
import UndefinedField from './fields/undefined-field';
import { capitalize } from '#lib/utils';

const fieldRegistry: Record<string, new (args: ValueFieldArgs) => Field> = {
    ArraybufferField,
    ArrayField,
    BigintField,
    Bigint64arrayField,
    Biguint64arrayField,
    BlobField,
    BooleanField,
    CryptokeyField,
    DataviewField,
    DateField,
    DomexceptionField,
    DommatrixField,
    DommatrixreadonlyField,
    DompointField,
    DompointreadonlyField,
    DomquadField,
    DomrectField,
    DomrectreadonlyField,
    ErrorField,
    FileField,
    FilelistField,
    FilesystemdirectoryhandleField,
    FilesystemfilehandleField,
    Float16arrayField,
    Float32arrayField,
    Float64arrayField,
    ImagebitmapField,
    ImagedataField,
    Int16arrayField,
    Int32arrayField,
    Int8arrayField,
    NullField,
    NumberField,
    MapField,
    ObjectField,
    RegexpField,
    RtccertificateField,
    SetField,
    StringField,
    UndefinedField,
    Uint16arrayField,
    Uint32arrayField,
    Uint8arrayField,
    Uint8clampedarrayField,
};

export const fieldFactory = (args: ValueFieldArgs) => {
    const fieldClass = fieldRegistry[`${capitalize(args.type)}Field`];
    if (!fieldClass) {
        throw new Error(`Class ${capitalize(args.type)}Field not implemented`);
    }
    return new fieldClass(args);
};
