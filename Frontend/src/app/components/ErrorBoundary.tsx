import { useRouteError, useNavigate } from 'react-router';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export function ErrorBoundary() {
    const error: any = useRouteError();
    const navigate = useNavigate();

    const is404 = error?.status === 404 || error?.message?.includes('Not Found');

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} className="text-red-500" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                    {is404 ? 'Page Not Found' : 'Something went wrong'}
                </h1>

                <p className="text-slate-500 mb-8">
                    {is404
                        ? "The page or resource you're looking for doesn't exist or has been moved."
                        : error?.statusText || error?.message || "An unexpected error occurred in the application."}
                </p>

                <button
                    onClick={() => navigate(-1)}
                    className="w-full flex items-center justify-center py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <ArrowLeft size={18} className="mr-2" />
                    Go Back
                </button>

                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full mt-3 flex items-center justify-center py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
}
