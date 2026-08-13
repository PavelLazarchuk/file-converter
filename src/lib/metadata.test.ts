import { describe, expect, it } from 'vitest';

import { parseMetadataReport, type MetadataReport } from './metadata';

const report: MetadataReport = {
    filename: 'shot.jpg',
    fileSize: 2048,
    format: 'JPEG',
    width: 24,
    height: 16,
    coordinates: null,
    removable: ['EXIF'],
    groups: [{ title: 'File', rows: [{ label: 'Format', value: 'JPEG' }] }],
};

describe('parseMetadataReport', () => {
    it('reads back a report the action serialized', () => {
        expect(parseMetadataReport(JSON.stringify(report))).toEqual(report);
    });

    it('returns null rather than throwing on anything else', () => {
        expect(parseMetadataReport('not json')).toBeNull();
        expect(parseMetadataReport('null')).toBeNull();
        expect(parseMetadataReport('{"filename":"a.jpg"}')).toBeNull();
        expect(parseMetadataReport(JSON.stringify({ ...report, groups: 'nope' }))).toBeNull();
    });
});
