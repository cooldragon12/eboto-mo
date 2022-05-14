import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardMain from '../components/DashboardMain'
import DashboardSidebar from '../components/DashboardSidebar'
import { dashboardSidebar, elections } from '../dummyData'
const Dashboard = () => {
    return (
        <div className='flex flex-col gap-4'>
            <select className="flex-initial w-1/4 h-auto rounded-lg p-4 outline-none cursor-pointer w-full" name="Election" id="election">
                {elections.map((election, id) => (
                    <option key={id} value={election.name}>{election.name}</option>
                ))}
            </select>

            <div className="space-x-4 flex">
                <div className="flex-initial w-1/4 bg-white min-w-fit rounded-tr-lg overflow-hidden">
                    <DashboardSidebar />
                </div>
                <div className="flex-auto w-auto h-fit bg-white p-4">
                    <Routes>
                        {dashboardSidebar.map((dashboard) => (
                            <Route key={dashboard.id} exact path={`/${dashboard.name.toLowerCase()}`} element={<DashboardMain type={dashboard.name.toLowerCase()} />} />
                        ))}
                    </Routes>
                    {/* <span className='font-bold text-xl'>test</span> */}
                </div>
            </div >

        </div >
    )
}

export default Dashboard