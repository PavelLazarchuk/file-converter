'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SIZE_PRESETS, outputSizeLabel, type SizePreset } from '@/lib/image';

type SizePresetsProps = {
    activeKey: string | null;
    disabled?: boolean;
    hint: string;
    onSelect: (preset: SizePreset) => void;
};

export function SizePresets({ activeKey, disabled, hint, onSelect }: SizePresetsProps) {
    return (
        <div className="space-y-2">
            <Label>Social &amp; web presets</Label>
            <div className="flex flex-wrap gap-2">
                {SIZE_PRESETS.map(preset => {
                    const active = preset.key === activeKey;

                    return (
                        <Button
                            key={preset.key}
                            type="button"
                            size="sm"
                            variant={active ? 'default' : 'outline'}
                            aria-pressed={active}
                            disabled={disabled}
                            onClick={() => onSelect(preset)}
                            className="font-normal"
                        >
                            {preset.label}
                            <span className="text-xs text-muted-foreground group-data-[variant=default]/button:text-primary-foreground/80">
                                {outputSizeLabel(preset)}
                            </span>
                        </Button>
                    );
                })}
            </div>
            <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}
