import { describe, expect, it } from 'vitest';
import { getMudakopVersionRow } from '../helpers/getMudakopVersionRow';
import type { StoreType } from '../../../services/store.service';

function makeDiagnosticsSystemInfo(
  patch: Partial<StoreType['diagnosticsSystemInfo']> = {},
): StoreType['diagnosticsSystemInfo'] {
  return {
    loading: false,
    mudakop_version: '1.2.3',
    mudakop_latest_version: '1.2.3',
    luci_app_version: '1.0.0',
    sing_box_version: '1.11.0',
    openwrt_version: 'OpenWrt 25.12',
    device_model: 'Test Router',
    ...patch,
  };
}

describe('getMudakopVersionRow', () => {
  it('returns Latest when versions differ only by leading v', () => {
    const row = getMudakopVersionRow(
      makeDiagnosticsSystemInfo({
        mudakop_version: 'v1.2.3',
        mudakop_latest_version: '1.2.3',
      }),
    );

    expect(row).toEqual({
      key: 'mudakop',
      value: 'v1.2.3',
      tag: {
        label: 'Latest',
        kind: 'success',
      },
    });
  });

  it('returns Outdated when versions differ', () => {
    const row = getMudakopVersionRow(
      makeDiagnosticsSystemInfo({
        mudakop_version: '1.2.2',
        mudakop_latest_version: '1.2.3',
      }),
    );

    expect(row).toEqual({
      key: 'mudakop',
      value: '1.2.2',
      tag: {
        label: 'Outdated',
        kind: 'warning',
      },
    });
  });

  it('returns Latest when the installed build is plain and the tag is -r<n>', () => {
    const row = getMudakopVersionRow(
      makeDiagnosticsSystemInfo({
        mudakop_version: '0.1.0',
        mudakop_latest_version: '0.1.0-r2',
      }),
    );

    expect(row).toEqual({
      key: 'mudakop',
      value: '0.1.0',
      tag: {
        label: 'Latest',
        kind: 'success',
      },
    });
  });

  it('returns Outdated when the released version actually moved on', () => {
    const row = getMudakopVersionRow(
      makeDiagnosticsSystemInfo({
        mudakop_version: '0.1.0',
        mudakop_latest_version: '0.2.0-r1',
      }),
    );

    expect(row).toEqual({
      key: 'mudakop',
      value: '0.1.0',
      tag: {
        label: 'Outdated',
        kind: 'warning',
      },
    });
  });

  it('returns plain row without tag for dev build', () => {
    const row = getMudakopVersionRow(
      makeDiagnosticsSystemInfo({
        mudakop_version: 'COMPILED_VERSION',
      }),
    );

    expect(row).toEqual({
      key: 'mudakop',
      value: 'dev',
    });
  });
});
