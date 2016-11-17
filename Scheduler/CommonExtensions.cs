using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace myday.scheduler
{
    public static class CommonExtensions
    {
        public static void ForEach<T>(this IEnumerable<T> @this, Action<T> fn) {
            foreach(var i in @this) fn(i);
        }


    }
}
