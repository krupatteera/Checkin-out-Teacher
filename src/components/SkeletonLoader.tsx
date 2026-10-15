import React from 'react';

export const AttendanceSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Clock section skeleton */}
      <div className="h-44 bg-slate-200/80 rounded-3xl" />
      {/* Profile skeleton */}
      <div className="p-6 bg-white rounded-3xl space-y-3">
        <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto -mt-12 border-4 border-white" />
        <div className="h-5 bg-slate-200 rounded-lg w-1/2 mx-auto" />
        <div className="h-4 bg-slate-200 rounded-lg w-1/3 mx-auto" />
      </div>
      {/* Action buttons skeleton */}
      <div className="space-y-3">
        <div className="h-20 bg-slate-200/80 rounded-2xl" />
        <div className="h-20 bg-slate-200/80 rounded-2xl" />
        <div className="h-20 bg-slate-200/80 rounded-2xl" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-8 bg-slate-200/70 rounded-xl w-1/4" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
};
