import { normalizeCompiledVersion } from '../../../../helpers/normalizeCompiledVersion';
import { getVersionCore } from '../../../../helpers/getVersionCore';
import type { StoreType } from '../../../services/store.service';
import type { IRenderSystemInfoRow } from '../partials';

function isUnknownVersion(version?: string | null): boolean {
  return version === 'unknown' || version === _('unknown');
}

export function getMudakopVersionRow(
  diagnosticsSystemInfo: StoreType['diagnosticsSystemInfo'],
): IRenderSystemInfoRow {
  const loading = diagnosticsSystemInfo.loading;
  const unknown = isUnknownVersion(diagnosticsSystemInfo.mudakop_version);
  const hasActualVersion =
    Boolean(diagnosticsSystemInfo.mudakop_latest_version) &&
    !isUnknownVersion(diagnosticsSystemInfo.mudakop_latest_version);
  const version = normalizeCompiledVersion(
    diagnosticsSystemInfo.mudakop_version,
  );
  const isDevVersion = version === 'dev';

  if (loading || unknown || !hasActualVersion || isDevVersion) {
    return {
      key: 'mudakop',
      value: version,
    };
  }

  if (
    getVersionCore(version) !==
    getVersionCore(diagnosticsSystemInfo.mudakop_latest_version)
  ) {
    return {
      key: 'mudakop',
      value: version,
      tag: {
        label: _('Outdated'),
        kind: 'warning',
      },
    };
  }

  return {
    key: 'mudakop',
    value: version,
    tag: {
      label: _('Latest'),
      kind: 'success',
    },
  };
}
