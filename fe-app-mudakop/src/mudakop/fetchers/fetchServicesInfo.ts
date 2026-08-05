import { mudakopShellMethods } from '../methods';
import { store } from '../services';

export async function fetchServicesInfo() {
  const [mudakop, singbox] = await Promise.all([
    mudakopShellMethods.getStatus(),
    mudakopShellMethods.getSingBoxStatus(),
  ]);

  if (!mudakop.success || !singbox.success) {
    store.set({
      servicesInfoWidget: {
        loading: false,
        failed: true,
        data: { singbox: 0, mudakop: 0 },
      },
    });
  }

  if (mudakop.success && singbox.success) {
    store.set({
      servicesInfoWidget: {
        loading: false,
        failed: false,
        data: { singbox: singbox.data.running, mudakop: mudakop.data.enabled },
      },
    });
  }
}
