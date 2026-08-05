import { callBaseMethod } from './callBaseMethod';
import { ClashAPI, Mudakop } from '../../types';

export const mudakopShellMethods = {
  checkDNSAvailable: async () =>
    callBaseMethod<Mudakop.DnsCheckResult>(
      Mudakop.AvailableMethods.CHECK_DNS_AVAILABLE,
    ),
  checkFakeIP: async () =>
    callBaseMethod<Mudakop.FakeIPCheckResult>(
      Mudakop.AvailableMethods.CHECK_FAKEIP,
    ),
  checkNftRules: async () =>
    callBaseMethod<Mudakop.NftRulesCheckResult>(
      Mudakop.AvailableMethods.CHECK_NFT_RULES,
    ),
  getStatus: async () =>
    callBaseMethod<Mudakop.GetStatus>(Mudakop.AvailableMethods.GET_STATUS),
  checkSingBox: async () =>
    callBaseMethod<Mudakop.SingBoxCheckResult>(
      Mudakop.AvailableMethods.CHECK_SING_BOX,
    ),
  getSingBoxStatus: async () =>
    callBaseMethod<Mudakop.GetSingBoxStatus>(
      Mudakop.AvailableMethods.GET_SING_BOX_STATUS,
    ),
  getClashApiProxies: async () =>
    callBaseMethod<ClashAPI.Proxies>(Mudakop.AvailableMethods.CLASH_API, [
      Mudakop.AvailableClashAPIMethods.GET_PROXIES,
    ]),
  getClashApiProxyLatency: async (tag: string) =>
    callBaseMethod<Mudakop.GetClashApiProxyLatency>(
      Mudakop.AvailableMethods.CLASH_API,
      [Mudakop.AvailableClashAPIMethods.GET_PROXY_LATENCY, tag, '5000'],
    ),
  getClashApiGroupLatency: async (tag: string) =>
    callBaseMethod<Mudakop.GetClashApiGroupLatency>(
      Mudakop.AvailableMethods.CLASH_API,
      [Mudakop.AvailableClashAPIMethods.GET_GROUP_LATENCY, tag, '10000'],
    ),
  setClashApiGroupProxy: async (group: string, proxy: string) =>
    callBaseMethod<unknown>(Mudakop.AvailableMethods.CLASH_API, [
      Mudakop.AvailableClashAPIMethods.SET_GROUP_PROXY,
      group,
      proxy,
    ]),
  restart: async () =>
    callBaseMethod<unknown>(
      Mudakop.AvailableMethods.RESTART,
      [],
      '/etc/init.d/mudakop',
    ),
  start: async () =>
    callBaseMethod<unknown>(
      Mudakop.AvailableMethods.START,
      [],
      '/etc/init.d/mudakop',
    ),
  stop: async () =>
    callBaseMethod<unknown>(
      Mudakop.AvailableMethods.STOP,
      [],
      '/etc/init.d/mudakop',
    ),
  enable: async () =>
    callBaseMethod<unknown>(
      Mudakop.AvailableMethods.ENABLE,
      [],
      '/etc/init.d/mudakop',
    ),
  disable: async () =>
    callBaseMethod<unknown>(
      Mudakop.AvailableMethods.DISABLE,
      [],
      '/etc/init.d/mudakop',
    ),
  globalCheck: async () =>
    callBaseMethod<unknown>(Mudakop.AvailableMethods.GLOBAL_CHECK),
  showSingBoxConfig: async () =>
    callBaseMethod<unknown>(Mudakop.AvailableMethods.SHOW_SING_BOX_CONFIG),
  checkLogs: async () =>
    callBaseMethod<unknown>(Mudakop.AvailableMethods.CHECK_LOGS),
  getSystemInfo: async () =>
    callBaseMethod<Mudakop.GetSystemInfo>(
      Mudakop.AvailableMethods.GET_SYSTEM_INFO,
    ),
};
