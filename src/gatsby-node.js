const crypto = require('crypto')
const axios = require('axios')
import { JobPostNode, DepartmentNode } from './nodes'

/**
 * Return all open jobs for a given department
 * @param apiToken string.
 * @param departmentId string.
 */
async function getJobsForDepartment(companyIdentifier, departmentId) {
  return getJobPosts(companyIdentifier, {
    department: departmentId
  })
}

/**
 * Return all job posts
 * @param apiToken string.
 * @param queryParams object, defaults to only live job posts
 */
async function getJobPosts(companyIdentifier, queryParams = {}) {
  return axios.get(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings`, {
    params: queryParams
  })
}

/**
 * Gets all departments for a given organization
 * @param apiToken string.
 */
async function getDepartments(companyIdentifier) {
  return axios.get(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/departments`)
}

/**
 * Gatsby requires ID to be a string to define nodes and greenhouse.io uses an integer instead.
 *
 * @param obj object.
 * @returns object.
 */
const changeId = obj => {
	const updatedObj = obj
	updatedObj.id = updatedObj.id.toString()
	return updatedObj
}

exports.sourceNodes = async ({ boundActionCreators }, { companyIdentifier, pluginOptions }) => {
	const { createNode } = boundActionCreators
  const options = pluginOptions || {}

  console.log(`Starting to fetch data from Smart Recruiters`)

  let departments, jobPosts
  try {
    departments = await getDepartments(companyIdentifier).then(response => response.data.content)
    jobPosts = await getJobPosts(companyIdentifier, options.jobPosts).then(response => response.data.content)
  } catch (e) {
    console.log(`Failed to fetch data from Smart Recruiters`)
    process.exit(1)
  }

  console.log(`jobPosts fetched`, jobPosts.length)
  console.log(`departments fetched`, departments.length)
  return Promise.all(
    departments.map(async department => {
      const convertedDepartment = changeId(department)
      
      let jobs
      try {
        const jobsForDepartmentResults = await getJobsForDepartment(companyIdentifier, convertedDepartment.id)
        jobs = jobsForDepartmentResults.data.content.map(job => changeId(job))
      } catch (e) {
        console.log(`Failed to fetch jobs for department.`)
        process.exit(1)
      }

      var jobPostsMapping = jobPosts.reduce((map, jobPost) => { 
        map[jobPost.id] = jobPost
        return map
      }, {})

      var jobPostsForDepartment = jobs.reduce((arr, job) => {
        const mappedJobPost = jobPostsMapping[job.id]
        if (mappedJobPost) {
          arr.push(mappedJobPost)
        }
        return arr
      }, [])

      convertedDepartment.jobPosts =  jobPostsForDepartment
      const departmentNode = DepartmentNode(changeId(convertedDepartment))

      jobPostsForDepartment.forEach(jobPost => {
        const convertedJobPost = changeId(jobPost)
        const jobPostNode = JobPostNode(convertedJobPost, { 
          parent: departmentNode.id 
        })
        createNode(jobPostNode)
      })
      
      createNode(departmentNode)
    })
  )
}
