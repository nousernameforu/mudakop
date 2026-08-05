import { insertIf } from '../../../../helpers';
import { DIAGNOSTICS_CHECKS_MAP } from './contstants';
import { mudakopShellMethods } from '../../../methods';
import { IDiagnosticsChecksItem } from '../../../services';
import { updateCheckStore } from './updateCheckStore';
import { getMeta } from '../helpers/getMeta';

export async function runFakeIPCheck() {
  const { order, title, code } = DIAGNOSTICS_CHECKS_MAP.FAKEIP;

  updateCheckStore({
    order,
    code,
    title,
    description: _('Checking, please wait'),
    state: 'loading',
    items: [],
  });

  const response = await mudakopShellMethods.checkFakeIP();

  if (!response.success) {
    updateCheckStore({
      order,
      code,
      title,
      description: _('Cannot receive checks result'),
      state: 'error',
      items: [],
    });

    return;
  }

  const { fakeip, IP, fakeip6, IP6 } = response.data;

  // The router reports the IPv6 fields only when IPv6 is enabled in the settings,
  // so an absent address means the check does not apply rather than failing
  const ipv6Checked = Boolean(IP6);

  const checks = {
    fakeip: Boolean(fakeip),
    fakeip6: Boolean(fakeip6),
  };

  const allGood = checks.fakeip && (!ipv6Checked || checks.fakeip6);
  const atLeastOneGood = checks.fakeip || (ipv6Checked && checks.fakeip6);

  const { state, description } = getMeta({ atLeastOneGood, allGood });

  updateCheckStore({
    order,
    code,
    title,
    description,
    state,
    items: [
      {
        state: checks.fakeip ? 'success' : 'error',
        key: checks.fakeip
          ? _('Sing-box returns FakeIP addresses')
          : _('Sing-box does not return FakeIP addresses'),
        value: IP,
      },
      ...insertIf<IDiagnosticsChecksItem>(ipv6Checked, [
        {
          state: checks.fakeip6 ? 'success' : 'error',
          key: checks.fakeip6
            ? _('Sing-box returns IPv6 FakeIP addresses')
            : _('Sing-box does not return IPv6 FakeIP addresses'),
          value: IP6,
        },
      ]),
    ],
  });
}
