using Microsoft.Owin;
using myday.scheduler.demo;
using Owin;
using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Owin.Cors;
using Microsoft.AspNet.SignalR;
using Collabco.Myday.Scheduler;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Reactive.Subjects;
using System.Reactive.Linq;

[assembly: OwinStartup(typeof(Startup))]

namespace myday.scheduler.demo
{

    public class Startup
    {
        public static void Configuration(IAppBuilder app) 
        {
            var reg = new SchedulerRegistry();
            
            var holder = reg.GetScheduler(Guid.Empty);
            holder.Scheduler.Notify(new Modulation(new JobKey(Guid.NewGuid()), 1D));
            
            GlobalHost.DependencyResolver.Register(typeof(SchedulerHub), () => new SchedulerHub(reg));
            
            app.UseCors(CorsOptions.AllowAll);
            app.MapSignalR();            
        }
    }

    
    public class SchedulerHolder
    {
        public readonly IObservable<JobKey> Calls;
        public readonly Scheduler Scheduler;
        
        public SchedulerHolder(Scheduler scheduler, IObservable<JobKey> calls) {
            Scheduler = scheduler;
            Calls = calls;
        }
    }



    public class SchedulerRegistry : IDisposable
    {
        bool _active = true;
        ConcurrentDictionary<Guid, SchedulerHolder> _dScheds;
        
        public SchedulerRegistry() 
        {
            _dScheds = new ConcurrentDictionary<Guid, SchedulerHolder>();            
        }

        public void RemoveScheduler(Guid id) {
            SchedulerHolder holder;

            if(_dScheds.TryRemove(id, out holder)) {
                //...                
            }
        }


        public SchedulerHolder GetScheduler(Guid id)
            => _dScheds.GetOrAdd(id,
                        i => {
                            var subject = new Subject<JobKey>();
                            
                            var sched = new Scheduler(
                                            rand: new Random(i.GetHashCode()),
                                            handler: k => subject.OnNext(k),
                                            optimum: new Optimum(1, 1)
                                            );

                            var driver = new Driver(sched);

                            driver.Start();

                            return new SchedulerHolder(sched, subject);
                        });
        

        public void Dispose() {
            _active = false;
        }

    }


    public class SchedulerHub : Hub
    {
        SchedulerRegistry _reg;

        public SchedulerHub(SchedulerRegistry reg) {
            _reg = reg;            
        }
        
        public void subscribeToScheduler(Guid schedId) {
            var holder = _reg.GetScheduler(schedId);
            var caller = Clients.Caller;

            holder.Calls.Subscribe(jk => {
                caller.handle(schedId, jk.Id);
            });
        }

        public void updateJob(Guid schedulerId, Guid jobId, double weight) {
            var holder = _reg.GetScheduler(schedulerId);
            
            holder.Scheduler.Notify(
                new Modulation(new JobKey(jobId), weight));
        }
        
        public void removeScheduler(Guid schedulerId) {
            _reg.RemoveScheduler(schedulerId);
        }


        public void setOverallLimit(Guid schedulerId, double limit) {
            var holder = _reg.GetScheduler(schedulerId);

            holder.Scheduler.Notify(
                new Modulation(overallLimit: limit));
        }
        
    }

}