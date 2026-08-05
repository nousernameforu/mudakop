import { FAKEIP_CHECK_DOMAIN, IP_CHECK_DOMAIN } from '../../../constants';
import { withTimeout } from '../../../helpers';

/**
 * Fires throwaway requests at the FakeIP probe domains so client traffic crosses the
 * nftables tproxy rules before check_nft_rules reads the counters.
 *
 * Nothing is hosted behind those domains - only the connection attempt matters, since
 * sing-box synthesizes a FakeIP address for them and the resulting packets are what
 * increments the counters. Every request here is therefore expected to fail, and any
 * failure is deliberately swallowed.
 */
export async function generateFakeIpTraffic(): Promise<void> {
  await Promise.allSettled(
    [FAKEIP_CHECK_DOMAIN, IP_CHECK_DOMAIN].map((domain) =>
      withTimeout(
        fetch(`https://${domain}/check`, { method: 'GET', mode: 'no-cors' }),
        5000,
        'generateFakeIpTraffic',
      ),
    ),
  );
}
