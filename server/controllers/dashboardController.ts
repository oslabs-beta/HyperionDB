import { Request, Response, NextFunction } from 'express';
import { DashboardController } from '../../types';
import axios from 'axios';
const k8s = require('@kubernetes/client-node');
//prometheus client for node.js
const client = require('prom-client');
const start = new Date(Date.now() - 1440 * 60000).toISOString();
const end = new Date(Date.now()).toISOString();

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
//CoreV1Api: it allows access to core k8 resources such as services
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
//AppsV1Api: it allows access to app/v1 resources such as deployments and k8s
const k8sApi1 = kc.makeApiClient(k8s.AppsV1Api);
//NetworkV1Api: (ingress) - Ingress is a collection of rules that allow inbound connections to reach the endpoints defined by a backend. An Ingress can be configured to give services externally-reachable urls, load balance traffic, terminate SSL, offer name based virtual hosting etc.
//https://docs.okd.io/latest/rest_api/network_apis/ingress-networking-k8s-io-v1.html
const k8sApi3 = kc.makeApiClient(k8s.NetworkingV1Api);
//to collect default metrics directly from prometheus client
//https://github.com/siimon/prom-client
client.collectDefaultMetrics();

const dashboardController: DashboardController = {
  totalCpu: async (req: Request, res: Response, next: NextFunction) => {
    try {
      //error: The Fetch API is an experimental feature. This feature could change at any time
      //if i use axios to make a fetch request, I get the error cannot read 'get' ...
      // const res = await fetch(`http://localhost:9090/api/v1/query_range?query=sum(rate(container_cpu_usage_seconds_total[10m]))*100&start=${start}&end=${end}&step=5m`, {
      //     method: 'GET',
      //     headers: {
      //         'Content-Type': 'application/json'
      //     }
      // })
      // const json = await res.json();
      // console.log(json);
      const response = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(rate(container_cpu_usage_seconds_total[10m]))*100&start=${start}&end=${end}&step=5m`
      );
      res.locals.totalCpu = await response.data;
      // console.log(res.locals.cpu);
      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard cpu data',
      });
    }
  },

  totalMem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(container_memory_usage_bytes)&start=${start}&end=${end}&step=5m`
      );
      res.locals.totalMem = await response.data;
      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard mem data',
      });
    }
  },

  totalPods: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=count(kube_pod_info)&start=${start}&end=${end}&step=5m`
      );
      // console.log(response.data.data.result[0].values[0]);
      res.locals.totalPods = await response.data;
      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard pods data',
      });
    }
  },

  totalReceive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(rate(node_network_receive_bytes_total[10m]))&start=${start}&end=${end}&step=10m`
      );
      const response = await data.data;
      res.locals.totalReceive = response;

      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard receive data',
      });
    }
  },

  totalTransmit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(rate(node_network_transmit_bytes_total[10m]))&start=${start}&end=${end}&step=5m`
      );
      const data = await response;
      res.locals.totalTransmit = data.data;
      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard transmit data',
      });
    }
  },

  totalNamespaces: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=count(kube_namespace_created)&start=${start}&end=${end}&step=5m`
      );
      res.locals.totalNamespaces = await response;
      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard transmit data',
      });
    }
  },

  cpuUsageOverTotalCpu: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const totalCpuUage = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(rate(container_cpu_usage_seconds_total[1m]))&start=${start}&end=${end}&step=5m`
      );
      const totalCore = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(machine_cpu_cores)&start=${start}&end=${end}&step=5m`
      );
      const percentageOfCore = await axios.get(
        `http://localhost:9090/api/v1/query_range?query=sum(rate(container_cpu_usage_seconds_total[1m]))/sum(machine_cpu_cores)*100&start=${start}&end=${end}&step=5m`
      );
      const cpuUsageOverTotalCpu = await totalCpuUage;
      const totalCoreInCluster = await totalCore;
      const percent = await percentageOfCore;
      res.locals.cpuUsageOverTotalCpu = {
        cpu: cpuUsageOverTotalCpu.data.data.result[0],
        core: totalCoreInCluster.data.data.result[0],
        percent: percent.data.data.result[0]
      }
      return next();
    } catch (err) {
      return next({
        log: `Error in dashboardController.getTotalCpu: ${err}`,
        status: 500,
        message: 'Error occured while retrieving dashboard transmit data',
      });
    }
  }
};

export default dashboardController;
