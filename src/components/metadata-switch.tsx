'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type MetadataSwitchProps = {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
};

export function MetadataSwitch({ checked, onCheckedChange, disabled }: MetadataSwitchProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-3">
                <Switch
                    id="remove-metadata"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={onCheckedChange}
                />
                <Label htmlFor="remove-metadata">
                    Remove metadata (EXIF, GPS location, ICC, XMP)
                </Label>
            </div>
            <p className="text-sm text-muted-foreground">
                {checked
                    ? 'Strips all embedded metadata from the output, including GPS location.'
                    : 'Keeps the original metadata in the output file.'}
            </p>
        </div>
    );
}
