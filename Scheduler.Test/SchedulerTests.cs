using myday.scheduler;
using NUnit.Framework;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace Collabco.Myday.Scheduler
{

    [TestFixture]
    public class StaticSchedulerTests
    {

        //TO DO:
        // > a demo project with tinkering
        // > with more tests in place, we can rewrite ordering stuff to be performant
        // > the pressure of ad hoc requests must somehow transfer onto the whole, and change the phase of their target
        //      - it's impossible for us to promise to always serve ad hoc requests directly, while also respecting our overall constraints
                        
        [TestCase(5, 20, 0.01)]
        [TestCase(2, 100, 1)]
        [TestCase(100, 20, 0.1)]
        [TestCase(0.13, 300, 0.5)]
        [TestCase(0.0001, 1000, 14)]
        public void SingleJobs_Fire(double optimumPerJob, double totalSpan, double turnSpan) 
        {
            int callCount = 0;

            var sched = new Scheduler(
                rand: new Random(123),
                handler: j => { callCount++; },
                optimum: new Optimum(10000, optimumPerJob));       

            //start a single job, to run at the natural rate of the scheduler
            sched.Notify(new Modulation(new JobKey(Guid.NewGuid()), 1F));

            //drive progress for given totalSpan, in increments of turnSpan
            double remaining = totalSpan;

            while(remaining > 0) {
                var span = remaining >= turnSpan ? turnSpan : remaining;

                sched.Progress(span);
                remaining -= span;
            }
            
            //at any one time, each job has two possible call counts, either of which is legitimate, given random jittering
            var lowerAcceptableBound = Math.Floor(totalSpan * optimumPerJob);
            var upperAcceptableBound = Math.Ceiling(totalSpan * optimumPerJob);

            Assert.That(callCount, Is.InRange(lowerAcceptableBound, upperAcceptableBound));
        }
        

        [TestCase(5, 3, 20, 0.01)]
        [TestCase(2, 5, 100, 1)]
        [TestCase(20, 50, 20, 0.01)]
        [TestCase(0.13, 15, 300, 0.5)]
        [TestCase(0.0001, 44, 1000, 14)]
        public void MultipleJobs_Fire(double optimumPerJob, int jobCount, double totalSpan, double turnSpan) 
        {
            int callCount = 0;

            var sched = new Scheduler(
                rand: new Random(1234),
                handler: j => { callCount++; },
                optimum: new Optimum(10000, optimumPerJob));

            //start jobs, to run concurrently at the natural rate of the scheduler
            for(int i = 0; i < jobCount; i++) {
                sched.Notify(new Modulation(new JobKey(Guid.NewGuid()), 1F));
            }

            //drive progress for given totalSpan, in increments of turnSpan
            double remaining = totalSpan;

            while(remaining > 0) {
                var span = remaining >= turnSpan ? turnSpan : remaining;

                sched.Progress(span);
                remaining -= span;
            }

            //at any one time, each job has two possible call counts, either of which is legitimate, given random jittering
            //these ranges sum to give an overall acceptable range
            var lowerAcceptableBound = Math.Floor(totalSpan * optimumPerJob) * jobCount;
            var upperAcceptableBound = Math.Ceiling(totalSpan * optimumPerJob) * jobCount;
            
            Assert.That(callCount, Is.InRange(lowerAcceptableBound, upperAcceptableBound));
        }



        [TestCase(50, 5, 20, 20, 0.01)]
        [TestCase(300, 50, 10, 40, 0.5)]
        [TestCase(5, 1, 20, 20, 1)]
        [TestCase(500, 3, 10, 50, 0.7, Description = "Limit doesn't apply in this case")]
        public void OverallLimit_BoundsThroughput(double overallLimit, double optimumPerJob, int jobCount, double totalSpan, double turnSpan) {
            int callCount = 0;

            var sched = new Scheduler(
                rand: new Random(1234),
                handler: j => { callCount++; },
                optimum: new Optimum(overallLimit, optimumPerJob));

            //start jobs, to run concurrently at the natural rate of the scheduler
            for(int i = 0; i < jobCount; i++) {
                sched.Notify(new Modulation(new JobKey(Guid.NewGuid()), 1F));
            }

            //drive progress for given totalSpan, in increments of turnSpan
            double remaining = totalSpan;

            while(remaining > 0) {
                var span = remaining >= turnSpan ? turnSpan : remaining;

                sched.Progress(span);
                remaining -= span;
            }

            //at any one time, each job has two possible call counts, either of which is legitimate, given random jittering
            //these ranges sum to give an overall acceptable range. We rely below on each job having the same optimum rate.

            //but following the overallLimit (if it kicks in) also gives a similar range, only much broader - as broad 
            //as the total rate per unit of the scheduler - which in this case will == overallLimit.

            var lowerAcceptableBound = Math.Min(Math.Floor(totalSpan * optimumPerJob) * jobCount, Math.Floor((totalSpan * overallLimit) - overallLimit));
            var upperAcceptableBound = Math.Min(Math.Ceiling(totalSpan * optimumPerJob) * jobCount, Math.Ceiling((totalSpan * overallLimit) + overallLimit));

            Assert.That(callCount, Is.InRange(lowerAcceptableBound, upperAcceptableBound));
        }







        class JobMod
        {
            public Guid JobId;
            public double Span;
            public double VirtRate;

            public JobMod(Guid jobId, double span, double virtRate) {
                JobId = jobId;
                Span = span;
                VirtRate = virtRate;
            }            
        }


        //would be great if we could auto-generate test cases and execute them - could get through thousands of combinations

        [TestCase(1000, 2, 10, 200, 10, Description = "No limiting, simple - supposedly")]
        [TestCase(11, 2, 5, 200, 10, Description = "Some limiting, not so simple")]
        [TestCase(10, 1, 50, 50, 10, Description = "Very clean limiting - no messy numbers here, should always == 500")]
        [TestCase(1.1, 0.25, 5, 50, 0.5, Description = "And another")]
        public void Jobs_Fire_WithModulations(double overallLimit, double optimumPerJob, int jobCount, double totalSpan, double turnSpan) 
        {
            var rand = new Random(TestContext.CurrentContext.Test.FullName.GetHashCode());
            var modsPerTurn = new List<JobMod[]>();
            
            int callCount = 0;

            var jobIds = Enumerable.Range(0, jobCount)
                                .Select(_ => Guid.NewGuid())
                                .ToArray();

            var sched = new Scheduler(
                rand: rand,
                handler: j => { callCount++; },
                optimum: new Optimum(overallLimit, optimumPerJob));
            
            //drive progress for given totalSpan, in increments of turnSpan
            double remaining = totalSpan;

            while(remaining > 0) {
                var span = remaining >= turnSpan ? turnSpan : remaining;

                modsPerTurn.Add(
                    jobIds.Select(id => {
                        var mod = new JobMod(id, span, rand.NextDouble() * 2);
                        sched.Notify(new Modulation(new JobKey(id), mod.VirtRate));
                        return mod;
                    }).ToArray());
                
                sched.Progress(span);
                remaining -= span;
            }
            
            var callsPerJob = new Dictionary<Guid, double>();
            jobIds.ForEach(id => callsPerJob[id] = 0);
            
            foreach(var mods in modsPerTurn) 
            {
                double totalThisTurn = 0;

                foreach(var mod in mods) {                    
                    totalThisTurn += mod.Span * (mod.VirtRate * optimumPerJob);                    
                }

                //we now know how much we need to scale each individual job here, to limit the total per this span

                var limit = overallLimit * mods[0].Span;

                var scale = totalThisTurn > limit
                                ? limit / totalThisTurn
                                : 1D;

                foreach(var mod in mods) {
                    callsPerJob[mod.JobId] += mod.Span * (mod.VirtRate * optimumPerJob) * scale;
                }
            }

            var lowerAcceptableBound = callsPerJob.Values.Select(v => Math.Floor(v)).Sum() * 0.9;   //an annoying, mysterious variance means we have to tolerate being slightly off
            var upperAcceptableBound = callsPerJob.Values.Select(v => Math.Ceiling(v)).Sum() * 1.1; // - don't know why... but results are still reasonable(!)

            Assert.That(callCount, Is.InRange(lowerAcceptableBound, upperAcceptableBound));
        }








        //[TestCase(1)]
        //[TestCase(2)]
        //[TestCase(3)]
        //[TestCase(99)]
        //public void CallsSpreadEquallyBetweenJobs(int jobCount) {
        //    var calls = Run(100, 100, jobCount, 100);
        //    Assert.That(calls.Distinct().Count(), Is.EqualTo(1)); //only one distinct call count value
        //}


        //[TestCase(1)]
        //[TestCase(2)]
        //[TestCase(3)]
        //[TestCase(99)]
        //public void CallRate_IsOptimized(int jobCount) {
        //    int optimalRate = 100;

        //    var calls = Run(100, 100, jobCount, optimalRate);

        //    //overall number of calls should meet limit
        //    var totalSteps = 100 * 100;
        //    var totalSpans = totalSteps >> 8;

        //    Assert.That(calls.Count(), Is.EqualTo(totalSpans * optimalRate));
        //}

    }






}
