using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace Collabco.Myday.Scheduler
{


    public struct JobKey
    {
        public readonly Guid Id;

        public JobKey(Guid id) {
            Id = id;
        }
    }



    public enum ModulationType
    {
        JobRate,
        OverallLimit
    }


    public struct Modulation  //mods are timeless - they will be applied (in order) as soon as they are serialized into the world of the scheduler
    {
        public readonly ModulationType Type;
        public readonly double Rate;
        public readonly JobKey Key;

        public Modulation(JobKey key, double weight) {
            Type = ModulationType.JobRate;
            Key = key;
            Rate = weight;
        }

        public Modulation(double overallLimit) {
            Type = ModulationType.OverallLimit;
            Key = default(JobKey);
            Rate = overallLimit;
        }
    }


    public struct Optimum
    {
        public readonly double OverallRealLimit;
        public readonly double RealRatePerJob;

        public Optimum(double overallRealLimit, double realRatePerJob) {
            OverallRealLimit = overallRealLimit;
            RealRatePerJob = realRatePerJob;
        }
    }






    public class Scheduler
    {
        Queue<Instance> _qInstances;
        ConcurrentQueue<Modulation> _qMods;
        Dictionary<JobKey, JobState> _dJobs;
        Random _rand;

        Action<JobKey> _jobHandler;
        Optimum _optimum;
        long _nextInstanceId = 1L;
        double _overallRate = 0D;
        double _time = 0D;


        public Scheduler(Random rand, Action<JobKey> handler, Optimum optimum) {
            _rand = rand;
            _jobHandler = handler;
            _optimum = optimum;

            _qInstances = new Queue<Instance>();
            _qMods = new ConcurrentQueue<Modulation>();
            _dJobs = new Dictionary<JobKey, JobState>();
        }


        public void Notify(Modulation mod) { //params of optimum should be passed by Notify too
            _qMods.Enqueue(mod);
        }


        public void Progress(double realSpan) {
            ProcessMods(_time);

            var span = ScaleToVirtual(realSpan);
            var nextTime = _time + span;

            while(_qInstances.Count > 0 && _qInstances.Peek().Time < nextTime) {
                ProcessInstance(_qInstances.Dequeue());
            }

            _time = nextTime;
        }


        double ScaleToVirtual(double realPeriod) {
            var scale = _optimum.RealRatePerJob;

            if(scale * _overallRate > _optimum.OverallRealLimit) {                
               scale = _optimum.OverallRealLimit / _overallRate;
            }

            return scale * realPeriod;
        }


        void ProcessInstance(Instance inst) {            
            if(inst.Id != inst.Job.State.NextInstanceId) return;
            
            _jobHandler(inst.Job.Key);
            PlaceJob(inst.Time, inst.Job);
        }

        void ProcessMods(double now) {
            Modulation mod;

            while(_qMods.TryDequeue(out mod)) {
                ProcessMod(now, mod);
            }
        }

        void ProcessMod(double now, Modulation mod) {
            switch(mod.Type) {                    /////////////////////////////////////////////////////////////////////////////
                case ModulationType.OverallLimit: //OVERALL LIMIT MODS MUST BE PROCESSED FIRST FROM MOD QUEUE!!!!!!!!!
                    _optimum = new Optimum(mod.Rate, _optimum.RealRatePerJob);
                    break;

                case ModulationType.JobRate:
                    var key = mod.Key;

                    if(mod.Rate == 0) {
                        ClearJobState(key);
                    }
                    else {
                        var state = GetJobState(key);
                        PlaceJob(now, new JobInfo(key, state), mod.Rate);
                    }
                    break;
            }
        }



        void PlaceJob(double now, JobInfo job)
            => PlaceJob(now, job, job.State.Rate);

        void PlaceJob(double now, JobInfo job, double newRate) {
            var key = job.Key;
            var state = job.State;

            _overallRate += (newRate - state.Rate);

            var phase = state.Fresh ? _rand.NextDouble() : ((state.NextTime - now) / state.Step);
            var newStep = 1 / newRate;
            var delay = (1 - phase) * newStep;

            var instance = new Instance(_nextInstanceId++, now + delay, job);

            Schedule(instance);

            state.Fresh = false;
            state.Rate = newRate;
            state.Step = newStep;
            state.NextInstanceId = instance.Id;
            state.NextTime = instance.Time;
        }



        void Schedule(Instance inst) {
            _qInstances.Enqueue(inst);
            _qInstances = new Queue<Instance>(_qInstances.OrderBy(i => i.Time)); //!!!
        }



        JobState GetJobState(JobKey key) {
            JobState job;

            if(!_dJobs.TryGetValue(key, out job)) {
                job = new JobState();
                _dJobs.Add(key, job);
            }

            return job;
        }

        void ClearJobState(JobKey key) {
            JobState state;

            if(_dJobs.TryGetValue(key, out state)) {
                state.Clear();
                _dJobs.Remove(key);
            }
        }



        struct JobInfo
        {
            public readonly JobKey Key;
            public readonly JobState State;

            public JobInfo(JobKey key, JobState state) {
                Key = key;
                State = state;
            }
        }


        struct Instance
        {
            public readonly long Id;
            public readonly double Time;
            public readonly JobInfo Job;

            public Instance(long id, double time, JobInfo job) {
                Id = id;
                Time = time;
                Job = job;
            }
        }


        class JobState
        {
            public double Rate;
            public double Step;

            public double NextTime;
            public long NextInstanceId;

            public bool Fresh = true;

            public void Clear() {
                Rate = Step = NextTime = 0;
                NextInstanceId = 0;
            }
        }

    }






}
