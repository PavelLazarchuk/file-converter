'use client';

import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type MetadataSwitchProps = {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
};

export function MetadataSwitch({ checked, onCheckedChange, disabled }: MetadataSwitchProps) {
    const t = useTranslations('MetadataSwitch');

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-3">
                <Switch
                    id="remove-metadata"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={onCheckedChange}
                />
                <Label htmlFor="remove-metadata">{t('label')}</Label>
            </div>
            <p className="text-sm text-muted-foreground">{checked ? t('on') : t('off')}</p>
        </div>
    );
}
