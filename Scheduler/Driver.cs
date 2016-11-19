using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Collabco.Myday.Scheduler
{
    public class Driver
    {
        Scheduler _sched;
        double _maxStep;

        public Driver(Scheduler sched, double maxStep = 1D) {
            _sched = sched;
            _maxStep = maxStep;
        }
        

        public IDisposable Start() {
            var cancelSource = new CancellationTokenSource();
            var cancelToken = cancelSource.Token;

            Task.Run(async () => {
                var last = DateTime.Now;

                while(!cancelToken.IsCancellationRequested) {
                    var now = DateTime.Now;
                    var diff = now - last;
                    
                    _sched.Progress(Math.Min(diff.TotalSeconds, _maxStep));
                    last = now;

                    await Task.Delay(50, cancelToken);
                }
            });


            return new Handle(cancelSource);
        }




        class Handle : IDisposable
        {
            CancellationTokenSource _cancelSource;

            public Handle(CancellationTokenSource cancelSource) {
                _cancelSource = cancelSource;
            }

            public void Dispose() {
                _cancelSource.Cancel();
            }
        }


    }
}
